import re

FILE_PATH = r"C:\Users\LENOVO\Desktop\munshee.pk\EVAL-REPORT.md"

with open(FILE_PATH, "rb") as f:
    data = f.read()

# Fix 1: Replace control characters that replace letters
# Tab (0x09) replaces t
data = data.replace(b'	' + b'emperature', b'temperature')
data = data.replace(b'	' + b'ool_name', b'tool_name')
data = data.replace(b'	' + b'sc', b'tsc')

# Bell (0x07) replaces a
data = data.replace(b'' + b'ctor_type', b'actor_type')
data = data.replace(b'' + b'ction', b'action')
data = data.replace(b'' + b'udit', b'audit')
data = data.replace(b'' + b'ctor', b'actor')

# Vertical tab (0x0b) replaces v
data = data.replace(b'' + b'alidateFact', b'validateFact')

# Backspace (0x08) replaces b
data = data.replace(b'' + b'usinessName', b'businessName')

# Form feed (0x0c) replaces f
data = data.replace(b'' + b'acts[]', b'facts[]')

# Fix 2: Replace single-backtick-only lines with triple backticks
lines = data.split(b'\n')
fixed_lines = []
for line in lines:
    stripped = line.strip()
    if stripped == b'`':
        fixed_lines.append(b'```')
    else:
        fixed_lines.append(line)
data = b'\n'.join(fixed_lines)

# Fix 3: Remove extra spaces inside inline code backticks
data = re.sub(b'`\\s+([^`\\s][^`]*?)\\s+`', b'`\\1`', data)

with open(FILE_PATH, "wb") as f:
    f.write(data)

print("Fixed EVAL-REPORT.md")
