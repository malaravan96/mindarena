package com.mindarena.pip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Standalone BroadcastReceiver declared in AndroidManifest for PiP remote actions.
 * This handles intents from PiP window buttons and foreground notification actions.
 *
 * The actual event emission to JS is handled by the dynamic receiver registered
 * in PiPModule. This receiver serves as a manifest-declared backup that ensures
 * the intents are received even if the dynamic receiver is not yet registered.
 */
class PiPActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // The PiPModule's dynamically registered receiver handles the JS emission.
        // This manifest-declared receiver exists as a fallback to ensure the
        // broadcast system can resolve the PendingIntents.
        // Events are forwarded to JS by PiPModule's internal receiver.
    }
}
