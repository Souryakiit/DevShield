# Utility functions
import os
import json
from datetime import datetime

def format_date(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def load_config(path):
    with open(path, 'r') as f:
        return json.load(f)

def slugify(text):
    return text.lower().strip().replace(' ', '-')

def get_env(key, default=None):
    return os.environ.get(key, default)

def chunk_list(lst, size):
    return [lst[i:i+size] for i in range(0, len(lst), size)]
