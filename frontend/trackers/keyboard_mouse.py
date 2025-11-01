from collections import deque
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

    