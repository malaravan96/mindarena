import Foundation
import CallKit
import AVFoundation

/// Manages CallKit integration for keeping audio calls alive in background on iOS.
/// iOS does not support true video PiP for WebRTC views (AVPictureInPictureController
/// requires AVPlayerLayer/AVSampleBufferDisplayLayer), so we use CallKit to:
/// - Keep audio running when app is backgrounded
/// - Show call controls on lock screen and in the iOS call UI
/// - Allow mute/hangup from the system UI
class PiPCallKitManager: NSObject, CXProviderDelegate {

    static let shared = PiPCallKitManager()

    private var provider: CXProvider?
    private let callController = CXCallController()
    private var activeCallUUID: UUID?

    // Callbacks to React Native
    var onMuteAction: ((Bool) -> Void)?
    var onEndCallAction: (() -> Void)?

    private override init() {
        super.init()
        setupProvider()
    }

    private func setupProvider() {
        let config = CXProviderConfiguration()
        config.supportsVideo = true
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        config.iconTemplateImageData = nil // App icon used by default

        provider = CXProvider(configuration: config)
        provider?.setDelegate(self, queue: DispatchQueue.main)
    }

    // MARK: - Public API

    /// Report an outgoing call to CallKit (called when user initiates a call)
    func reportOutgoingCall(peerName: String, hasVideo: Bool) {
        let uuid = UUID()
        activeCallUUID = uuid

        let handle = CXHandle(type: .generic, value: peerName)
        let startAction = CXStartCallAction(call: uuid, handle: handle)
        startAction.isVideo = hasVideo

        let transaction = CXTransaction(action: startAction)
        callController.request(transaction) { [weak self] error in
            if error == nil {
                // Notify system that the call connected
                self?.provider?.reportOutgoingCall(with: uuid, connectedAt: Date())
            }
        }

        configureAudioSession()
    }

    /// Report an incoming call to CallKit
    func reportIncomingCall(peerName: String, hasVideo: Bool, completion: ((Error?) -> Void)? = nil) {
        let uuid = UUID()
        activeCallUUID = uuid

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: peerName)
        update.localizedCallerName = peerName
        update.hasVideo = hasVideo
        update.supportsGrouping = false
        update.supportsHolding = false

        provider?.reportNewIncomingCall(with: uuid, update: update) { error in
            completion?(error)
        }

        configureAudioSession()
    }

    /// End the active CallKit call
    func endCall() {
        guard let uuid = activeCallUUID else { return }

        let endAction = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: endAction)
        callController.request(transaction) { _ in }

        activeCallUUID = nil
    }

    /// Report that the call has connected (for incoming calls after accepting)
    func reportCallConnected() {
        guard let uuid = activeCallUUID else { return }
        provider?.reportOutgoingCall(with: uuid, connectedAt: Date())
    }

    /// Report that the remote peer ended the call
    func reportCallEnded(reason: CXCallEndedReason = .remoteEnded) {
        guard let uuid = activeCallUUID else { return }
        provider?.reportCall(with: uuid, endedAt: Date(), reason: reason)
        activeCallUUID = nil
    }

    var hasActiveCall: Bool {
        return activeCallUUID != nil
    }

    // MARK: - Audio Session

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try session.setActive(true)
        } catch {
            // Audio session configuration failed — WebRTC may handle this itself
        }
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        activeCallUUID = nil
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        configureAudioSession()
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        configureAudioSession()
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        onEndCallAction?()
        activeCallUUID = nil
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        onMuteAction?(action.isMuted)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // WebRTC handles audio session activation
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        // WebRTC handles audio session deactivation
    }
}
