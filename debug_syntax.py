
import re

def check_structure(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    
    # Simple tokenizer that ignores strings and comments
    # This is a basic implementation for debugging
    
    def get_tokens(line):
        tokens = []
        i = 0
        in_string = False
        string_char = ''
        in_comment = False
        
        while i < len(line):
            char = line[i]
            
            if in_comment:
                # Single line comment ends at newline, which is handled by line processing
                break
                
            if in_string:
                if char == '\\':
                    i += 2 # Skip escaped char
                    continue
                if char == string_char:
                    in_string = False
                i += 1
                continue
                
            if char == '/' and i + 1 < len(line) and line[i+1] == '/':
                in_comment = True
                i += 2
                continue
                
            if char in "\"'`":
                in_string = True
                string_char = char
                i += 1
                continue
                
            if char in '{[()]}':
                tokens.append((char, i))
                
            i += 1
        return tokens

    for line_idx, line in enumerate(lines):
        tokens = get_tokens(line)
        for char, char_idx in tokens:
            if char in '{[(':
                stack.append((char, line_idx + 1, char_idx + 1))
            elif char in '}])':
                if not stack:
                    print(f"Error: Unexpected '{char}' at line {line_idx + 1}, col {char_idx + 1}")
                    return
                
                last_char, last_line, last_col = stack.pop()
                expected_map = {'{': '}', '[': ']', '(': ')'}
                if expected_map[last_char] != char:
                    print(f"Error: Mismatched '{char}' at line {line_idx + 1}, col {char_idx + 1}. Expected closing for '{last_char}' from line {last_line}")
                    return

    if stack:
        char, line, col = stack[-1]
        print(f"Error: Unclosed '{char}' from line {line}, col {col}")
    else:
        print("Structure seems valid")

check_structure('src/config/database.js')
