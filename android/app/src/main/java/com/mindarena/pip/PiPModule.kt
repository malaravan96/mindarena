package com.mindarena.pip

import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Rational
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.ReactContextBaseJavaModule

class PiPModule(react: ReactApplicationContext) : ReactContextBaseJavaModule(react) {

    companion object {
        const val ACTION_TOGGLE_MUTE = "com.mindarena.pip.ACTION_TOGGLE_MUTE"
        const val ACTION_HANG_UP = "com.mindarena.pip.ACTION_HANG_UP"

        @Volatile
        private var callActive = false

        @Volatile
        private var isMuted = false

        @Volatile
        private var isInPiPMode = false

        private var moduleInstance: PiPModule? = null

        @JvmStatic
        fun onUserLeaveHint(activity: Activity) {
            if (!callActive || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            if (!activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
            try {
                activity.enterPictureInPictureMode(buildPiPParams(activity))
            } catch (e: Exception) {
                // Ignore
            }
        }

        @JvmStatic
        fun onPiPModeChanged(isInPiP: Boolean) {
            isInPiPMode = isInPiP
            moduleInstance?.emitPiPModeChanged(isInPiP)
        }

        private fun buildPiPParams(activity: Activity): PictureInPictureParams {
            val builder = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .setActions(buildRemoteActions(activity))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(callActive)
                builder.setSeamlessResizeEnabled(true)
            }
            return builder.build()
        }

        private fun buildRemoteActions(context: Context): List<RemoteAction> {
            val actions = mutableListOf<RemoteAction>()
            val muteIcon = if (isMuted) {
                Icon.createWithResource(context, android.R.drawable.ic_lock_silent_mode)
            } else {
                Icon.createWithResource(context, android.R.drawable.ic_lock_silent_mode_off)
            }
            val muteTitle = if (isMuted) "Unmute" else "Mute"
            val muteIntent = PendingIntent.getBroadcast(
                context, 1,
                Intent(ACTION_TOGGLE_MUTE).setPackage(context.packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            actions.add(RemoteAction(muteIcon, muteTitle, muteTitle, muteIntent))
            val hangUpIcon = Icon.createWithResource(context, android.R.drawable.ic_menu_close_clear_cancel)
            val hangUpIntent = PendingIntent.getBroadcast(
                context, 2,
                Intent(ACTION_HANG_UP).setPackage(context.packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            actions.add(RemoteAction(hangUpIcon, "Hang Up", "End call", hangUpIntent))
            return actions
        }
    }

    private var actionReceiver: BroadcastReceiver? = null

    override fun getName(): String = "PiPModule"

    override fun initialize() {
        super.initialize()
        moduleInstance = this
        registerActionReceiver()
    }

    override fun invalidate() {
        super.invalidate()
        unregisterActionReceiver()
        if (moduleInstance == this) {
            moduleInstance = null
        }
    }

    private fun getActivity(): Activity? {
        return reactApplicationContext.currentActivity as? Activity
    }

    @ReactMethod
    fun enterPiP(promise: Promise) {
        val act = getActivity()
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("UNSUPPORTED", "PiP requires Android 8.0+")
            return
        }
        try {
            if (!act.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) {
                promise.reject("UNSUPPORTED", "Device does not support PiP")
                return
            }
            val params = buildPiPParams(act)
            act.enterPictureInPictureMode(params)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PIP_ERROR", "Failed to enter PiP: ${e.message}")
        }
    }

    @ReactMethod
    fun exitPiP(promise: Promise) {
        val act = getActivity()
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        try {
            val intent = Intent(act, act.javaClass)
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            act.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PIP_ERROR", "Failed to exit PiP: ${e.message}")
        }
    }

    @ReactMethod
    fun isPiPSupported(promise: Promise) {
        val act = getActivity()
        if (act == null) {
            promise.resolve(false)
            return
        }
        try {
            val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                act.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
            promise.resolve(supported)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setCallActive(active: Boolean) {
        callActive = active
        val act = getActivity()
        if (act != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val params = buildPiPParams(act)
                act.setPictureInPictureParams(params)
            } catch (e: Exception) {
                // Ignored
            }
        }
        if (active) {
            startForegroundServiceInternal("Call in progress")
        } else {
            stopForegroundServiceInternal()
        }
    }

    @ReactMethod
    fun updatePiPActions(muted: Boolean) {
        isMuted = muted
        val act = getActivity()
        if (act != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            (isInPiPMode || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)) {
            try {
                val params = buildPiPParams(act)
                act.setPictureInPictureParams(params)
            } catch (e: Exception) {
                // Ignored
            }
        }
    }

    @ReactMethod
    fun startForegroundService(peerName: String) {
        startForegroundServiceInternal(peerName)
    }

    @ReactMethod
    fun stopForegroundService() {
        stopForegroundServiceInternal()
    }

    @ReactMethod
    fun getIsInPiPMode(promise: Promise) {
        promise.resolve(isInPiPMode)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun startForegroundServiceInternal(peerName: String) {
        try {
            val context: Context = reactApplicationContext
            val intent = Intent(context, CallForegroundService::class.java)
            intent.putExtra("peerName", peerName)
            ContextCompat.startForegroundService(context, intent)
        } catch (e: Exception) {
            // Ignore
        }
    }

    private fun stopForegroundServiceInternal() {
        try {
            val context: Context = reactApplicationContext
            val intent = Intent(context, CallForegroundService::class.java)
            context.stopService(intent)
        } catch (e: Exception) {
            // Ignore
        }
    }

    private fun emitPiPModeChanged(isInPiP: Boolean) {
        try {
            val params = Arguments.createMap().apply {
                putBoolean("isInPiP", isInPiP)
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onPiPModeChanged", params)
        } catch (e: Exception) {
            // Ignore
        }
    }

    fun emitPiPAction(action: String) {
        try {
            val params = Arguments.createMap().apply {
                putString("action", action)
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onPiPAction", params)
        } catch (e: Exception) {
            // Ignore
        }
    }

    private fun registerActionReceiver() {
        if (actionReceiver != null) return
        actionReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    ACTION_TOGGLE_MUTE -> emitPiPAction("toggleMute")
                    ACTION_HANG_UP -> emitPiPAction("hangUp")
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(ACTION_TOGGLE_MUTE)
            addAction(ACTION_HANG_UP)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactApplicationContext.registerReceiver(actionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactApplicationContext.registerReceiver(actionReceiver, filter)
            }
        } catch (e: Exception) {
            // Ignore
        }
    }

    private fun unregisterActionReceiver() {
        actionReceiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (e: Exception) {
                // Ignore
            }
            actionReceiver = null
        }
    }
}
