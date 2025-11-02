from collections import deque
import datetime
from pynput import keyboard, mouse
from threading import Thread, Lock
import time


class ActivityTracker:
    def __init__ (self):
        self.keystroke_times = deque()
        self.mouse_move_times = deque()
        self.mouse_click_times = deque()

        self.lock = Lock()
        self.running = False

        self.time_window = 60

        self.keyboard_listener = None
        self.mouse_listener = None

    def _on_key_press(self, key):
        with self.lock:
            self.keystroke_times.append(time.time())

    def _on_mouse_move(self,x , y):
        with self.lock:
            self.mouse_move_times.append(time.time())

    def _on_mouse_click(self, x, y, button, pressed):
        if pressed:
            with self.lock:
                self.mouse_click_times.append(time.time())

    def _clean_old_events(self):
        current_time = time.time()
        time_frame = current_time - self.time_window

        with self.lock:
            while self.keystroke_times and self.keystroke_times[0] < time_frame:
                self.keystroke_times.popleft()

            while self.mouse_click_times and self.mouse_click_times[0] < time_frame:
                self.mouse_click_times.popleft()

            while self.mouse_move_times and self.mouse_move_times[0] < time_frame:
                self.mouse_move_times.popleft()

    def get_stats(self):
        self._clean_old_events()

        with self.lock:
            return {
                "keystrokes_per_minute": len(self.keystroke_times),
                "mouse_moves_per_minute": len(self.mouse_move_times),
                "mouse_clicks_per_minute": len(self.mouse_click_times),
                
            }
        
    def start(self):
        if self.running:
            print("Tracker already runnning")
            return
        
        self.running = True

        # Start keyboard listener
        self.keyboard_listener = keyboard.Listener(
            on_press=self._on_key_press
        )
        self.keyboard_listener.start()
        
        # Start mouse listener
        self.mouse_listener = mouse.Listener(
            on_move=self._on_mouse_move,
            on_click=self._on_mouse_click
        )
        self.mouse_listener.start()

        print("Activity tracker started")

    def stop(self):
        if not self.running:
            return
        
        self.running = False

        if self.keyboard_listener:
            self.keyboard_listener.stop()
        
        if self.mouse_listener:
            self.mouse_listener.stop()

    def reset(self):
        with self.lock:
            self.keystroke_times.clear()
            self.mouse_move_times.clear()
            self.mouse_click_times.clear()

tracker = ActivityTracker()

if __name__ == "__main__":
    # Test the tracker
    print("Starting activity tracker test...")
    print("Move your mouse and type to see activity...")
    print("Press Ctrl+C to stop\n")
    
    tracker.start()
    
    try:
        while True:
            time.sleep(5)  # Update every 5 seconds
            stats = tracker.get_stats()
            print(f"Keystrokes/min: {stats['keystrokes_per_minute']}")
            print(f"Mouse moves/min: {stats['mouse_moves_per_minute']}")
            print(f"Mouse clicks/min: {stats['mouse_clicks_per_minute']}")
            print("---")
    except KeyboardInterrupt:
        print("\nStopping tracker...")
        tracker.stop()