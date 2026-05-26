import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/bullion_price.dart';
import '../data/services/websocket_service.dart';
import '../data/services/home_widget_service.dart';

// ============================================================================
// 1. RIVERPOD PATTERN IMPLEMENTATION
// ============================================================================

/// Riverpod StateNotifier to listen to WebSocket and manage immutable price states.
class RealtimePriceNotifier extends StateNotifier<BullionPrice?> {
  StreamSubscription<BullionPrice>? _priceSubscription;
  StreamSubscription<SocketConnectionState>? _stateSubscription;
  
  SocketConnectionState _connectionState = SocketConnectionState.disconnected;
  SocketConnectionState get connectionState => _connectionState;

  RealtimePriceNotifier() : super(WebSocketService.instance.lastPrice) {
    _subscribe();
  }

  void _subscribe() {
    // 1. Subscribe to Live Bullion Pricing changes
    _priceSubscription = WebSocketService.instance.priceStream.listen(
      (newPrice) {
        state = newPrice;
        // Automatically sync to Android Home Widget on every price tick
        HomeWidgetService.instance.updateHomeWidget(newPrice);
      },
      onError: (err) {
        // State survives errors, but we can capture telemetry here
      }
    );

    // 2. Subscribe to WebSocket connection state changes
    _stateSubscription = WebSocketService.instance.stateStream.listen((state) {
      _connectionState = state;
    });
  }

  @override
  void dispose() {
    _priceSubscription?.cancel();
    _stateSubscription?.cancel();
    super.dispose();
  }
}

/// Global Riverpod Provider accessible anywhere inside the Widget Tree.
final realtimePriceProvider = StateNotifierProvider<RealtimePriceNotifier, BullionPrice?>((ref) {
  return RealtimePriceNotifier();
});

// ============================================================================
// 2. CLASSIC PROVIDER (ChangeNotifier) PATTERN IMPLEMENTATION
// ============================================================================

/// Classic Provider ChangeNotifier for applications running standard flutter_provider.
class RealtimePriceChangeNotifier extends ChangeNotifier {
  StreamSubscription<BullionPrice>? _priceSubscription;
  StreamSubscription<SocketConnectionState>? _stateSubscription;
  
  BullionPrice? _currentPrice = WebSocketService.instance.lastPrice;
  BullionPrice? get currentPrice => _currentPrice;

  SocketConnectionState _connectionState = SocketConnectionState.disconnected;
  SocketConnectionState get connectionState => _connectionState;

  RealtimePriceChangeNotifier() {
    _subscribe();
  }

  void _subscribe() {
    // 1. Subscribe to Live Pricing Changes
    _priceSubscription = WebSocketService.instance.priceStream.listen(
      (newPrice) {
        _currentPrice = newPrice;
        notifyListeners(); // Force UI update
        // Sync to SharedPreferences for Android Widget update
        HomeWidgetService.instance.updateHomeWidget(newPrice);
      },
    );

    // 2. Subscribe to WebSocket States
    _stateSubscription = WebSocketService.instance.stateStream.listen((state) {
      _connectionState = state;
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _priceSubscription?.cancel();
    _stateSubscription?.cancel();
    super.dispose();
  }
}
