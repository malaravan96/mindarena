#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PiPModule, RCTEventEmitter)

RCT_EXTERN_METHOD(enterPiP:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(exitPiP:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isPiPSupported:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setCallActive:(BOOL)active
                  peerName:(NSString *)peerName
                  hasVideo:(BOOL)hasVideo)

RCT_EXTERN_METHOD(updatePiPActions:(BOOL)muted)

RCT_EXTERN_METHOD(startForegroundService:(NSString *)peerName)

RCT_EXTERN_METHOD(stopForegroundService)

RCT_EXTERN_METHOD(getIsInPiPMode:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
