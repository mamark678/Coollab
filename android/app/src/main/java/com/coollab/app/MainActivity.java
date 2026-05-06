package com.coollab.app;

import android.os.Bundle;
import android.util.Log;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "COOLLAB_NATIVE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "MainActivity onCreate called");
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Log.d(TAG, "MainActivity onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        if (data != null) {
            Log.d(TAG, "MainActivity onActivityResult data: " + data.toString());
        }
    }
}
