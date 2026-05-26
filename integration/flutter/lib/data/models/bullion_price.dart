import 'dart:convert';

/// High-fidelity Dart model representing bullion price structures.
/// Captures spots, day highs, day lows, exchange rates, and metadata.
class BullionPrice {
  final double goldSpot;
  final double silverSpot;
  final double usdInr;
  final double goldHigh;
  final double goldLow;
  final double silverHigh;
  final double silverLow;
  final DateTime timestamp;

  BullionPrice({
    required this.goldSpot,
    required this.silverSpot,
    required this.usdInr,
    required this.goldHigh,
    required this.goldLow,
    required this.silverHigh,
    required this.silverLow,
    required this.timestamp,
  });

  /// Factory constructors for parsing live WebSocket updates.
  factory BullionPrice.fromJson(Map<String, dynamic> json) {
    return BullionPrice(
      goldSpot: (json['gold_spot'] as num).toDouble(),
      silverSpot: (json['silver_spot'] as num).toDouble(),
      usdInr: (json['usd_inr'] as num).toDouble(),
      goldHigh: (json['gold_high'] as num).toDouble(),
      goldLow: (json['gold_low'] as num).toDouble(),
      silverHigh: (json['silver_high'] as num).toDouble(),
      silverLow: (json['silver_low'] as num).toDouble(),
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        ((json['timestamp'] as num) * 1000).toInt(),
      ),
    );
  }

  factory BullionPrice.fromJsonString(String rawJson) {
    return BullionPrice.fromJson(jsonDecode(rawJson) as Map<String, dynamic>);
  }

  Map<String, dynamic> toJson() {
    return {
      'gold_spot': goldSpot,
      'silver_spot': silverSpot,
      'usd_inr': usdInr,
      'gold_high': goldHigh,
      'gold_low': goldLow,
      'silver_high': silverHigh,
      'silver_low': silverLow,
      'timestamp': timestamp.millisecondsSinceEpoch / 1000.0,
    };
  }

  /// Copy constructor helper for quick immutable mutations or mock adjustments.
  BullionPrice copyWith({
    double? goldSpot,
    double? silverSpot,
    double? usdInr,
    double? goldHigh,
    double? goldLow,
    double? silverHigh,
    double? silverLow,
    DateTime? timestamp,
  }) {
    return BullionPrice(
      goldSpot: goldSpot ?? this.goldSpot,
      silverSpot: silverSpot ?? this.silverSpot,
      usdInr: usdInr ?? this.usdInr,
      goldHigh: goldHigh ?? this.goldHigh,
      goldLow: goldLow ?? this.goldLow,
      silverHigh: silverHigh ?? this.silverHigh,
      silverLow: silverLow ?? this.silverLow,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}
