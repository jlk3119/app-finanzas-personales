package app.misfinanzas.wrapper;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // El WebView no descarga URLs blob: por sí solo. Exponemos un puente para que
        // el código web entregue el archivo en base64 y aquí lo guardamos en Descargas.
        WebView webView = getBridge().getWebView();
        webView.addJavascriptInterface(new DownloadBridge(), "AndroidDownloader");
    }

    private class DownloadBridge {
        @JavascriptInterface
        public void saveBase64File(String base64, String filename, String mime) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    saveViaMediaStore(data, filename, mime);
                } else {
                    saveToPublicDownloads(data, filename);
                }
                toast("Descargado en Descargas: " + filename);
            } catch (Exception e) {
                toast("No se pudo guardar el archivo");
            }
        }

        private void saveViaMediaStore(byte[] data, String filename, String mime) throws Exception {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri item = getContentResolver().insert(collection, values);
            if (item == null) throw new Exception("insert returned null");

            try (OutputStream os = getContentResolver().openOutputStream(item)) {
                if (os == null) throw new Exception("openOutputStream returned null");
                os.write(data);
            }

            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(item, values, null, null);
        }

        private void saveToPublicDownloads(byte[] data, String filename) throws Exception {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File file = new File(dir, filename);
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(data);
            }
        }
    }

    private void toast(String message) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
    }
}
