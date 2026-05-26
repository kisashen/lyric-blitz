#!/usr/bin/env python3
import os
import re
import json

redundant_words = ["yeah","whoa","ohh","ooh","oh","ah","huh","uh","hey","eh","la","mmmm","mmm","mm","na", "ahh"]

def pure(text):
    return re.sub('[^a-zA-Z0-9]', '', text.lower())

def is_meaningful(lyric, title):
    if pure(title) in pure(lyric):
        return False
    lyric_cleaned = pure(lyric)
    for word in redundant_words:
        lyric_cleaned = lyric_cleaned.replace(word, "")
    return lyric_cleaned != ""

def export_to_javascript(directory):
    web_database = []

    # Replicating your directory parsing logic
    for root, dirs, files in os.walk(directory):
        for filename in files:
            if filename.startswith('.'): # Skip hidden files
                continue

            filepath = os.path.join(root, filename)

            # Determine album name from parent folder
            album_name = os.path.basename(root) if root != directory else "Unknown Album"

            # Parse track number and title using your exact regex logic
            track_num = 0
            song_title = ""
            match_title = re.match(r"^(track)*(deluxe)*(vault)*_(\d+)_(.*)", filename)
            if match_title:
                track_num = int(match_title.group(4))
                song_title = match_title.group(5).replace("_", " ")
            else:
                song_title = filename.replace("_", " ").replace(".txt", "")

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    lines = [line.strip() for line in f.readlines() if line.strip()]

                # Filter lines using your custom guardrails
                meaningful_lyrics = [line for line in lines if is_meaningful(line, song_title)]

                if meaningful_lyrics: # Only add if the song has valid quiz lines
                    web_database.append({
                        "title": song_title,
                        "album": album_name,
                        "track_num": track_num,
                        "snippets": meaningful_lyrics
                    })
            except Exception as e:
                print(f"Skipping file {filename} due to error: {e}")

    # Write out as a JavaScript file that our index.html can read
    with open("song_database.js", "w", encoding="utf-8") as out_f:
        out_f.write("// Auto-generated Taylor Swift Song Database\n")
        out_f.write("const songDatabase = ")
        out_f.write(json.dumps(web_database, indent=2))
        out_f.write(";\n")

    print(f"Success! Processed {len(web_database)} songs into song_database.js")

if __name__ == "__main__":
    # Assumes your lyrics are in a folder named "lyrics". Change if needed.
    target_dir = "lyrics" if os.path.exists("lyrics") else "."
    export_to_javascript(target_dir)
