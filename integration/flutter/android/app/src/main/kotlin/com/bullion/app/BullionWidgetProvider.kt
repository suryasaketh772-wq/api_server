package com.bullion.app

import android.app.PendingIntent
import android.app.widget.AppWidgetManager
import android.app.widget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews
import java.text.DecimalFormat

/**
 * Highly responsive Android AppWidgetProvider that binds SharedPreference pricing caches 
 * into live RemoteViews layouts. Triggers instant redrawing upon Dart websocket signals.
 */
class BullionWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val PREFS_NAME = "HomeWidgetPreferences"
        private val decimalFormat = DecimalFormat("$#,##0.00")
        private val rateFormat = DecimalFormat("##0.00")
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Read stored pricing telemetry written by Flutter HomeWidgetService
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, prefs)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        prefs: SharedPreferences
    ) {
        // Resolve package-specific layout resources
        val views = RemoteViews(context.packageName, R.layout.bullion_widget_layout)

        // Retrieve pricing fields safely, falling back to sentinel defaults on fresh boot
        val goldSpot = prefs.getFloat("gold_spot", 0.0f)
        val silverSpot = prefs.getFloat("silver_spot", 0.0f)
        val usdInr = prefs.getFloat("usd_inr", 0.0f)
        
        val goldHigh = prefs.getFloat("gold_high", 0.0f)
        val goldLow = prefs.getFloat("gold_low", 0.0f)
        val silverHigh = prefs.getFloat("silver_high", 0.0f)
        val silverLow = prefs.getFloat("silver_low", 0.0f)
        
        val lastUpdated = prefs.getString("last_updated", "Initializing...") ?: "Initializing..."

        // Format and bind Gold stats
        views.setTextViewText(R.id.gold_spot, if (goldSpot > 0) decimalFormat.format(goldSpot) else "$--")
        views.setTextViewText(R.id.gold_high, if (goldHigh > 0) "H: ${decimalFormat.format(goldHigh)}" else "H: $--")
        views.setTextViewText(R.id.gold_low, if (goldLow > 0) "L: ${decimalFormat.format(goldLow)}" else "L: $--")

        // Format and bind Silver stats
        views.setTextViewText(R.id.silver_spot, if (silverSpot > 0) decimalFormat.format(silverSpot) else "$--")
        views.setTextViewText(R.id.silver_high, if (silverHigh > 0) "H: ${decimalFormat.format(silverHigh)}" else "H: $--")
        views.setTextViewText(R.id.silver_low, if (silverLow > 0) "L: ${decimalFormat.format(silverLow)}" else "L: $--")

        // Format exchange rates & timestamps
        views.setTextViewText(R.id.usd_inr, if (usdInr > 0) "USD/INR: ${rateFormat.format(usdInr)}" else "USD/INR: --")
        views.setTextViewText(R.id.last_updated, lastUpdated)

        // Setup PendingIntent click handler to open the app on click
        // Dynamically loads the target main activity of the flutter application
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            // Flags matching modern Android 12+ required PendingIntent properties (FLAG_IMMUTABLE)
            val pendingIntent = PendingIntent.getActivity(
                context, 
                0, 
                launchIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            // Bind action target to the root LinearLayout view node
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        }

        // Apply changes
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
