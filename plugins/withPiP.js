const {
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  withMainActivity,
  withMainApplication,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ─── Android Manifest ───────────────────────────────────────────────────────

function withPiPAndroidManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return cfg;

    // ── MainActivity attributes ──
    const mainActivity = app.activity?.find(
      (a) =>
        a.$?.["android:name"] === ".MainActivity" ||
        a.$?.["android:name"]?.endsWith(".MainActivity")
    );
    if (mainActivity) {
      mainActivity.$["android:supportsPictureInPicture"] = "true";
      mainActivity.$["android:resizeableActivity"] = "true";

      // Merge configChanges
      const existing = mainActivity.$["android:configChanges"] || "";
      const required = [
        "screenSize",
        "smallestScreenSize",
        "screenLayout",
        "orientation",
      ];
      const parts = existing.split("|").filter(Boolean);
      for (const r of required) {
        if (!parts.includes(r)) parts.push(r);
      }
      mainActivity.$["android:configChanges"] = parts.join("|");
    }

    // ── Foreground service declaration ──
    const serviceExists = app.service?.some(
      (s) =>
        s.$?.["android:name"] === "com.mindarena.pip.CallForegroundService"
    );
    if (!serviceExists) {
      if (!app.service) app.service = [];
      app.service.push({
        $: {
          "android:name": "com.mindarena.pip.CallForegroundService",
          "android:foregroundServiceType": "camera|microphone",
          "android:exported": "false",
        },
      });
    }

    // ── Broadcast receiver declaration ──
    const receiverExists = app.receiver?.some(
      (r) => r.$?.["android:name"] === "com.mindarena.pip.PiPActionReceiver"
    );
    if (!receiverExists) {
      if (!app.receiver) app.receiver = [];
      app.receiver.push({
        $: {
          "android:name": "com.mindarena.pip.PiPActionReceiver",
          "android:exported": "false",
        },
      });
    }

    // ── Permissions ──
    const requiredPerms = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_CAMERA",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    ];
    if (!manifest.manifest["uses-permission"]) {
      manifest.manifest["uses-permission"] = [];
    }
    const perms = manifest.manifest["uses-permission"];
    for (const p of requiredPerms) {
      if (!perms.some((e) => e.$?.["android:name"] === p)) {
        perms.push({ $: { "android:name": p } });
      }
    }

    return cfg;
  });
}

// ─── Android: Inject onUserLeaveHint + onPictureInPictureModeChanged ────────

function withPiPMainActivity(config) {
  return withMainActivity(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Add import for PiPModule helper if not already present
    if (!contents.includes("com.mindarena.pip.PiPModule")) {
      contents = contents.replace(
        /^(package .+)$/m,
        `$1\n\nimport com.mindarena.pip.PiPModule`
      );
    }

    // Add import for Configuration if needed
    if (!contents.includes("import android.content.res.Configuration")) {
      contents = contents.replace(
        /^(import com\.mindarena\.pip\.PiPModule)$/m,
        `import android.content.res.Configuration\n$1`
      );
    }

    // Inject onUserLeaveHint override
    if (!contents.includes("onUserLeaveHint")) {
      const insertPoint = contents.lastIndexOf("}");
      const override = `
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    PiPModule.onUserLeaveHint(this)
  }

  override fun onPictureInPictureModeChanged(isInPiPMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPiPMode, newConfig)
    PiPModule.onPiPModeChanged(isInPiPMode)
  }
`;
      contents =
        contents.substring(0, insertPoint) + override + contents.substring(insertPoint);
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// ─── Android: Register PiPPackage in MainApplication ────────────────────────

function withPiPMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Add import for PiPPackage if not already present
    if (!contents.includes("com.mindarena.pip.PiPPackage")) {
      contents = contents.replace(
        /^(package .+)$/m,
        `$1\n\nimport com.mindarena.pip.PiPPackage`
      );
    }

    // Add PiPPackage() to getPackages()
    if (!contents.includes("PiPPackage()")) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{[^}]*\}/,
        (match) => {
          // Insert add(PiPPackage()) into the apply block
          return match.replace(
            /\/\/ Packages that cannot be autolinked yet can be added manually here.*\n.*\/\/ add\(MyReactNativePackage\(\)\)/,
            `// Packages that cannot be autolinked yet can be added manually here:\n              add(PiPPackage())`
          );
        }
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// ─── Android: Write native Kotlin source files ──────────────────────────────

const PIP_MODULE_KT = `package com.mindarena.pip

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PiPModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun enterPiP() {
        val activity = reactApplicationContext.currentActivity ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            activity.enterPictureInPictureMode(params)
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        const val NAME = "PiPModule"
        private var pipEnabled = false
        private var reactContext: ReactApplicationContext? = null

        fun setReactContext(context: ReactApplicationContext) {
            reactContext = context
        }

        fun setPiPEnabled(enabled: Boolean) {
            pipEnabled = enabled
        }

        fun onUserLeaveHint(activity: Activity) {
            if (!pipEnabled) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
                try {
                    activity.enterPictureInPictureMode(params)
                } catch (e: Exception) {
                    // PiP not available
                }
            }
        }

        fun onPiPModeChanged(isInPiPMode: Boolean) {
            reactContext?.emitDeviceEvent("onPiPModeChanged", isInPiPMode)
        }
    }
}
`;

const PIP_PACKAGE_KT = `package com.mindarena.pip

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class PiPPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            PiPModule.NAME -> {
                PiPModule.setReactContext(reactContext)
                PiPModule(reactContext)
            }
            else -> null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                PiPModule.NAME to ReactModuleInfo(
                    PiPModule.NAME,
                    PiPModule.NAME,
                    false,
                    false,
                    false,
                    false
                )
            )
        }
    }
}
`;

const CALL_FOREGROUND_SERVICE_KT = `package com.mindarena.pip

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

class CallForegroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Ongoing Call",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when a call is in progress"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("MindArena")
            .setContentText("Call in progress")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "mindarena_call_channel"
        private const val NOTIFICATION_ID = 1001
    }
}
`;

const PIP_ACTION_RECEIVER_KT = `package com.mindarena.pip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PiPActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        when (action) {
            ACTION_HANG_UP -> {
                PiPModule.onPiPModeChanged(false)
            }
        }
    }

    companion object {
        const val ACTION_HANG_UP = "com.mindarena.pip.ACTION_HANG_UP"
    }
}
`;

function withPiPNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const pipDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        "com",
        "mindarena",
        "pip"
      );
      fs.mkdirSync(pipDir, { recursive: true });

      fs.writeFileSync(path.join(pipDir, "PiPModule.kt"), PIP_MODULE_KT);
      fs.writeFileSync(path.join(pipDir, "PiPPackage.kt"), PIP_PACKAGE_KT);
      fs.writeFileSync(
        path.join(pipDir, "CallForegroundService.kt"),
        CALL_FOREGROUND_SERVICE_KT
      );
      fs.writeFileSync(
        path.join(pipDir, "PiPActionReceiver.kt"),
        PIP_ACTION_RECEIVER_KT
      );

      return cfg;
    },
  ]);
}

// ─── iOS: Info.plist background modes ───────────────────────────────────────

function withPiPInfoPlist(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    // Add background modes
    if (!plist.UIBackgroundModes) {
      plist.UIBackgroundModes = [];
    }
    const modes = plist.UIBackgroundModes;
    if (!modes.includes("audio")) modes.push("audio");
    if (!modes.includes("voip")) modes.push("voip");

    return cfg;
  });
}

// ─── iOS: Copy native Swift source files ────────────────────────────────────

// ─── Combined plugin ────────────────────────────────────────────────────────

function withPiP(config) {
  config = withPiPNativeFiles(config);
  config = withPiPAndroidManifest(config);
  config = withPiPMainActivity(config);
  config = withPiPMainApplication(config);
  config = withPiPInfoPlist(config);
  return config;
}

module.exports = withPiP;
