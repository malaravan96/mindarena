const {
  withAndroidManifest,
  withInfoPlist,
  withMainActivity,
  withMainApplication,
  withDangerousMod,
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

// ─── Android: Copy native Kotlin source files ───────────────────────────────

function withPiPAndroidNativeFiles(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const srcDir = path.join(
        projectRoot,
        "modules",
        "pip",
        "android",
        "src",
        "main",
        "java",
        "com",
        "mindarena",
        "pip"
      );
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        "com",
        "mindarena",
        "pip"
      );

      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".kt"));
        for (const file of files) {
          fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
      }

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

function withPiPiOSNativeFiles(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const srcDir = path.join(projectRoot, "modules", "pip", "ios");
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "MindArena",
        "PiP"
      );

      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        const files = fs
          .readdirSync(srcDir)
          .filter((f) => f.endsWith(".swift") || f.endsWith(".m"));
        for (const file of files) {
          fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
      }

      return cfg;
    },
  ]);
}

// ─── Combined plugin ────────────────────────────────────────────────────────

function withPiP(config) {
  config = withPiPAndroidManifest(config);
  config = withPiPMainActivity(config);
  config = withPiPMainApplication(config);
  config = withPiPAndroidNativeFiles(config);
  config = withPiPInfoPlist(config);
  config = withPiPiOSNativeFiles(config);
  return config;
}

module.exports = withPiP;
