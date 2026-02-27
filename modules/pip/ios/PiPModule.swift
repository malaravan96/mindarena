import Foundation
import React

@objc(PiPModule)
class PiPModule: RCTEventEmitter {

    private var hasListeners = false

    override init() {
        super.init()
        setupCallKitCallbacks()
    }

    // MARK: - RCTEventEmitter

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String] {
        return ["onPiPModeChanged", "onPiPAction", "onCallKitAction"]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // MARK: - Bridge Methods

    /// iOS does not support true video PiP for WebRTC.
    /// This is a no-op — the call stays alive via CallKit background audio.
    @objc func enterPiP(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        // On iOS, PiP for WebRTC video is not natively supported.
        // CallKit keeps the audio alive in background.
        resolve(false)
    }

    @objc func exitPiP(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        // No-op on iOS — app comes to foreground via user tap
        resolve(true)
    }

    /// Returns false for video PiP (not supported on iOS for WebRTC).
    /// CallKit audio background is always available.
    @objc func isPiPSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
        // True PiP (video window floating over other apps) is not available for WebRTC on iOS.
        // Background audio via CallKit is available.
        resolve(false)
    }

    /// Report call to CallKit so audio persists in background.
    @objc func setCallActive(_ active: Bool,
                              peerName: String,
                              hasVideo: Bool) {
        let callKit = PiPCallKitManager.shared

        if active {
            callKit.reportOutgoingCall(peerName: peerName, hasVideo: hasVideo)
        } else {
            callKit.endCall()
        }
    }

    /// No-op on iOS — PiP actions are handled by CallKit UI.
    @objc func updatePiPActions(_ muted: Bool) {
        // CallKit handles mute state via CXSetMutedCallAction
    }

    /// No-op on iOS — there is no foreground service concept.
    @objc func startForegroundService(_ peerName: String) {
        // iOS equivalent: CallKit handles background presence
    }

    /// No-op on iOS.
    @objc func stopForegroundService() {
        // No-op
    }

    @objc func getIsInPiPMode(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        // iOS doesn't have system PiP for this use case
        resolve(false)
    }

    // MARK: - CallKit Callbacks

    private func setupCallKitCallbacks() {
        let callKit = PiPCallKitManager.shared

        callKit.onEndCallAction = { [weak self] in
            guard let self = self, self.hasListeners else { return }
            self.sendEvent(withName: "onPiPAction", body: ["action": "hangUp"])
        }

        callKit.onMuteAction = { [weak self] isMuted in
            guard let self = self, self.hasListeners else { return }
            self.sendEvent(withName: "onCallKitAction", body: ["action": "mute", "isMuted": isMuted])
        }
    }
}
