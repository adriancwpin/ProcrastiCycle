from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from trackers import tracker

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension


@app.route('/api/activity', methods=['GET'])
def get_activity():
    """API endpoint to get current activity stats"""
    stats = tracker.get_stats()
    # Add timestamp and running status to the response
    stats['timestamp'] = time.time()
    stats['is_running'] = tracker.running
    return jsonify(stats)


@app.route('/api/status', methods=['GET'])
def get_status():
    """API endpoint to check if tracker is running"""
    return jsonify({
        "running": tracker.running,
        "message": "Activity tracker is operational" if tracker.running else "Activity tracker is stopped"
    })


@app.route('/api/start', methods=['POST'])
def start_tracking():
    """API endpoint to start tracking (called when Start button is clicked)"""
    try:
        if tracker.running:
            return jsonify({
                "success": False,
                "message": "Tracker is already running"
            }), 400
        
        # Get optional parameters from request
        data = request.get_json() if request.is_json else {}
        enable_logging = data.get('enable_logging', True)  # Default to True
        log_file_path = data.get('log_file_path', 'activity_log.jsonl')
        
        # Start the tracker with minute-based logging
        tracker.start(enable_logging=enable_logging, log_file_path=log_file_path)
        
        return jsonify({
            "success": True,
            "message": "Activity tracking started",
            "logging_enabled": enable_logging,
            "log_file": log_file_path if enable_logging else None
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error starting tracker: {str(e)}"
        }), 500


@app.route('/api/stop', methods=['POST'])
def stop_tracking():
    """API endpoint to stop tracking (called when Stop/End button is clicked)"""
    try:
        if not tracker.running:
            return jsonify({
                "success": False,
                "message": "Tracker is not running"
            }), 400
        
        # Stop the tracker
        tracker.stop()
        
        return jsonify({
            "success": True,
            "message": "Activity tracking stopped"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error stopping tracker: {str(e)}"
        }), 500


@app.route('/api/reset', methods=['POST'])
def reset_stats():
    """API endpoint to reset all stats"""
    tracker.reset()
    return jsonify({
        "success": True,
        "message": "Stats reset successfully"
    })


if __name__ == "__main__":
    print("Starting Flask API server...")
    print("API will be available at http://localhost:5000")
    print("\nAvailable endpoints:")
    print("  GET  /api/activity - Get current activity metrics")
    print("  GET  /api/status   - Check tracker status")
    print("  POST /api/start    - Start activity tracking")
    print("  POST /api/stop     - Stop activity tracking")
    print("  POST /api/reset    - Reset all statistics")
    print("\nWaiting for Start command from frontend...")
    print("Note: Tracker will NOT start automatically - use the Start button in the extension")
    
    try:
        # Run Flask app (tracker will be started via API call)
        app.run(host='0.0.0.0', port=5000, debug=False)
    except KeyboardInterrupt:
        print("\nShutting down...")
        if tracker.running:
            tracker.stop()