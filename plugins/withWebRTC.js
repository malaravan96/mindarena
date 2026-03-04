const {
  AndroidConfig,
  WarningAggregator,
  createRunOncePlugin,
  withInfoPlist,
} = require("expo/config-plugins");

const CAMERA_USAGE = "Allow $(PRODUCT_NAME) to access your camera";
const MICROPHONE_USAGE = "Allow $(PRODUCT_NAME) to access your microphone";
const pkg = { name: "react-native-webrtc-local-plugin", version: "1.0.0" };

const withWebRTCPermissions = (config, props = {}) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.NSCameraUsageDescription =
      props.cameraPermission || cfg.modResults.NSCameraUsageDescription || CAMERA_USAGE;
    cfg.modResults.NSMicrophoneUsageDescription =
      props.microphonePermission ||
      cfg.modResults.NSMicrophoneUsageDescription ||
      MICROPHONE_USAGE;
    return cfg;
  });

const withWebRTCBitcodeDisabled = (config) => {
  if (!config.ios) {
    config.ios = {};
  }
  if (config.ios.bitcode != null && config.ios.bitcode !== false) {
    WarningAggregator.addWarningIOS(
      "ios.bitcode",
      "WebRTC requires ios.bitcode=false and this plugin is overriding the current value."
    );
  }
  config.ios.bitcode = false;
  return config;
};

const withWebRTC = (config, props = {}) => {
  let cfg = config;
  cfg = withWebRTCPermissions(cfg, props);
  cfg = withWebRTCBitcodeDisabled(cfg);
  cfg = AndroidConfig.Permissions.withPermissions(cfg, [
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.CAMERA",
    "android.permission.INTERNET",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.RECORD_AUDIO",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.WAKE_LOCK",
    "android.permission.BLUETOOTH",
  ]);
  return cfg;
};

module.exports = createRunOncePlugin(withWebRTC, pkg.name, pkg.version);
