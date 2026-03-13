package com.mindarena.pip

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
