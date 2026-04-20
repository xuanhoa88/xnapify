import os
import glob

form_dir = '/Users/xuanguyen/Workspaces/react-starter-kit/shared/renderer/components/Form'
auth_dir = '/Users/xuanguyen/Workspaces/react-starter-kit/src/apps/(default)/views'

# update form components
for filepath in glob.glob(f"{form_dir}/**/*.js", recursive=True):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "size = '2'" in content:
        new_content = content.replace("size = '2'", "size = '3'")
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# update auth views buttons
for filepath in glob.glob(f"{auth_dir}/**/*.js", recursive=True):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "size='2'" in content:
        new_content = content.replace("size='2'", "size='3'")
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

