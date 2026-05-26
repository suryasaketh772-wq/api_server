import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;
import '../models/bullion_price.dart';

enum SocketConnectionState { disconnected, connecting, connected, reconnecting }

class WebSocketService {
  // Singleton pattern instantiation
  WebSocketService._internal();
  static final WebSocketService instance = WebSocketService._internal();

  late Uri _wsUri;
  WebSocketChannel? _channel;
  bool _isDisposed = false;
  
  // Connection states
  SocketConnectionState _connectionState = SocketConnectionState.disconnected;
  SocketConnectionState get connectionState => _connectionState;

  // Stream Controllers
  final StreamController<BullionPrice> _priceStreamController = 
      StreamController<BullionPrice>.broadcast();
  final StreamController<SocketConnectionState> _stateStreamController = 
      StreamController<SocketConnectionState>.broadcast();

  // Streams for UI consumption
  Stream<BullionPrice> get priceStream => _priceStreamController.stream;
  Stream<SocketConnectionState> get stateStream => _stateStreamController.stream;

  // Reconnection configuration
  int _reconnectAttempts = 0;
  final int _maxReconnectDelaySecs = 32;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;

  // Cache of the last received pricing data
  BullionPrice? _lastPrice;
  BullionPrice? get lastPrice => _lastPrice;

  /// Initializes the service with the given server base URI (e.g. ws://10.0.2.2:8000/ws/prices).
  void initialize(String wsUrlString) {
    _wsUri = Uri.parse(wsUrlString);
    developer.log('WebSocket Service Initialised for: $_wsUri', name: 'Bullion.WebSocket');
    _connect();
  }

  void _updateState(SocketConnectionState newState) {
    if (_connectionState != newState) {
      _connectionState = newState;
      if (!_stateStreamController.isClosed) {
        _stateStreamController.add(newState);
      }
      developer.log('Connection state updated: $newState', name: 'Bullion.WebSocket');
    }
  }

  /// Establishes the socket connection.
  void _connect() {
    if (_isDisposed) return;
    
    if (_connectionState == SocketConnectionState.disconnected) {
      _updateState(SocketConnectionState.connecting);
    }

    try {
      // Connect natively supporting cross-platform web_socket_channel
      _channel = WebSocketChannel.connect(_wsUri);
      
      _updateState(SocketConnectionState.connected);
      _reconnectAttempts = 0; // Reset backoff on success
      
      _startHeartbeat();

      // Start listening to the inbound message stream
      _channel!.stream.listen(
        (message) {
          _handleInboundMessage(message as String);
        },
        onError: (error) {
          developer.log('Socket Error: $error', name: 'Bullion.WebSocket', error: error);
          _handleDisconnect();
        },
        onDone: () {
          developer.log('Socket Connection Closed by Server', name: 'Bullion.WebSocket');
          _handleDisconnect();
        },
        cancelOnError: true,
      );
    } catch (e, stack) {
      developer.log('Error opening connection', name: 'Bullion.WebSocket', error: e, stackTrace: stack);
      _handleDisconnect();
    }
  }

  void _handleInboundMessage(String rawPayload) {
    try {
      if (rawPayload == 'pong') {
        developer.log('Pong received.', name: 'Bullion.WebSocket');
        return;
      }
      
      final Map<String, dynamic> data = jsonDecode(rawPayload) as Map<String, dynamic>;
      final priceUpdate = BullionPrice.fromJson(data);
      
      _lastPrice = priceUpdate;
      
      if (!_priceStreamController.isClosed) {
        _priceStreamController.add(priceUpdate);
      }
    } catch (e, stack) {
      developer.log('Failed to parse price update: $rawPayload', name: 'Bullion.WebSocket', error: e, stackTrace: stack);
    }
  }

  /// Disconnection recovery routine with exponential backoff delay.
  void _handleDisconnect() {
    _cleanupHeartbeat();
    if (_isDisposed) return;

    _updateState(_reconnectAttempts > 0 
        ? SocketConnectionState.reconnecting 
        : SocketConnectionState.disconnected);

    _channel = null;
    
    // Calculate exponential wait time (2^attempts seconds) with a maximum limit
    int backoffDelay = (1 << _reconnectAttempts);
    if (backoffDelay > _maxReconnectDelaySecs) {
      backoffDelay = _maxReconnectDelaySecs;
    }
    
    developer.log('Scheduling reconnection in $backoffDelay seconds (Attempt: ${_reconnectAttempts + 1})', name: 'Bullion.WebSocket');
    
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(seconds: backoffDelay), () {
      _reconnectAttempts++;
      _connect();
    });
  }

  /// Active Keep-Alive heartbeat mechanism.
  void _startHeartbeat() {
    _cleanupHeartbeat();
    // Send a minor keep-alive ping frame every 25s
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 25), (timer) {
      if (_connectionState == SocketConnectionState.connected && _channel != null) {
        try {
          _channel!.sink.add('ping');
          developer.log('Ping sent to server', name: 'Bullion.WebSocket');
        } catch (e) {
          developer.log('Heartbeat ping failed', name: 'Bullion.WebSocket', error: e);
          _handleDisconnect();
        }
      }
    });
  }

  void _cleanupHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  /// Terminates the instance, closes current streams, and cleans up timers.
  void dispose() {
    _isDisposed = true;
    _cleanupHeartbeat();
    _reconnectTimer?.cancel();
    
    if (_channel != null) {
      _channel!.sink.close(status.goingAway);
    }
    
    _priceStreamController.close();
    _stateStreamController.close();
    _updateState(SocketConnectionState.disconnected);
    
    developer.log('WebSocket Service disposed.', name: 'Bullion.WebSocket');
  }
}
