import 'dart:developer' as developer;
import 'package:home_widget/home_widget.dart';
import 'package:intl/intl.dart';
import '../models/bullion_price.dart';

class HomeWidgetService {
  HomeWidgetService._internal();
  static final HomeWidgetService instance = HomeWidgetService._internal();

  // Widget constants - Must match Android xml file and provider class
  static const String _androidWidgetName = 'BullionWidgetProvider';
  static const String _groupId = 'group.bullion.app'; // For iOS AppGroups matching (optional extension)

  /// Updates native shared storage structures and requests the OS redrawing routine.
  Future<void> updateHomeWidget(BullionPrice price) async {
    try {
      developer.log('Syncing price keys to SharedPreferences for Android Home Widget', name: 'Bullion.HomeWidget');
      
      // Save all active numeric pricing attributes
      await HomeWidget.saveWidgetData<double>('gold_spot', price.goldSpot);
      await HomeWidget.saveWidgetData<double>('silver_spot', price.silverSpot);
      await HomeWidget.saveWidgetData<double>('usd_inr', price.usdInr);
      await HomeWidget.saveWidgetData<double>('gold_high', price.goldHigh);
      await HomeWidget.saveWidgetData<double>('gold_low', price.goldLow);
      await HomeWidget.saveWidgetData<double>('silver_high', price.silverHigh);
      await HomeWidget.saveWidgetData<double>('silver_low', price.silverLow);
      
      // Save localized formatting last updated string for widget header
      final String formattedTime = DateFormat('hh:mm:ss a').format(price.timestamp.toLocal());
      await HomeWidget.saveWidgetData<String>('last_updated', 'Updated: $formattedTime');

      // Trigger the OS layout redrawing command
      final bool? success = await HomeWidget.updateWidget(
        androidName: _androidWidgetName,
        iOSName: _androidWidgetName, // Matches standard swift widget class if needed later
      );

      if (success == true) {
        developer.log('Native home widget successfully updated.', name: 'Bullion.HomeWidget');
      } else {
        developer.log('OS update returned false. Confirm widget is placed on the home screen.', name: 'Bullion.HomeWidget');
      }
    } catch (e, stack) {
      developer.log('Exception in HomeWidgetService update:', name: 'Bullion.HomeWidget', error: e, stackTrace: stack);
    }
  }
}
