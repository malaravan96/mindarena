package com.mindarena.pip

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
