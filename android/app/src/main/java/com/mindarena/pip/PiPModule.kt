package com.mindarena.pip

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
