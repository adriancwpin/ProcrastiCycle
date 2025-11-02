from flask import Flask, jsonify, request
import google.generativeai as genai
import json
import os
import re

app = Flask(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def get_average_score(urls: list) -> float:
    """
    Send all tab URLs to Gemini and get back a single average score.
    Returns a float between 0 and 1.
    """
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        # Format URLs as a numbered list
        urls_text = "\n".join([f"{i+1}. {url}" for i, url in enumerate(urls)])
        
        prompt = f"""
Score each of these browser tab URLs from 0 to 1 based on productivity, then calculate and return the average.

URLs:
{urls_text}

Scoring guide:
- 0 = unproductive (entertainment, social media, gaming)
- 0.5 = neutral (news, email)
- 1 = productive (work tools, documentation, development)

Respond with ONLY the average score as a number between 0 and 1 (e.g., 0.73).
"""
        
        response = model.generate_content(prompt)
        score_text = response.text.strip()
        
        # Extract the first number found in the response
        numbers = re.findall(r'0?\.\d+|1\.0|0|1', score_text)
        if numbers:
            score = float(numbers[0])
        else:
            score = float(score_text)
        
        # Ensure score is within bounds
        score = max(0.0, min(1.0, score))
        
        return score
    
    except Exception as e:
        print(f"Error: {e}")
        return 0.5

@app.route('/analyze-tabs', methods=['POST'])
def analyze_tabs():
    """
    Expects JSON with 'urls' array.
    Returns the average score as a float.
    """
    try:
        if not GEMINI_API_KEY:
            return jsonify({'error': 'API key not configured'}), 500
        
        data = request.get_json()
        
        if not data or 'urls' not in data:
            return jsonify({'error': 'Expected JSON with "urls" array'}), 400
        
        urls = data['urls']
        
        if not isinstance(urls, list) or len(urls) == 0:
            return jsonify({'error': 'Invalid or empty URLs array'}), 400
        
        # Filter out empty strings
        urls = [url for url in urls if url and isinstance(url, str)]
        
        if len(urls) == 0:
            return jsonify({'error': 'No valid URLs'}), 400
        
        # Get average score from Gemini
        score = get_average_score(urls)
        
        return jsonify({'average_score': round(score, 2)}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)