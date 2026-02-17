#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract fields using jq
model_name=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
used_percent=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
remaining_percent=$(echo "$input" | jq -r '.context_window.remaining_percentage // 100')

# Calculate progress bar (20 characters wide)
filled_width=$(awk "BEGIN {printf \"%d\", ($used_percent / 100 * 20)}")
empty_width=$((20 - filled_width))

# Create progress bar using block characters
progress_bar=""
for ((i=0; i<filled_width; i++)); do
    progress_bar+="█"
done
for ((i=0; i<empty_width; i++)); do
    progress_bar+="░"
done

# Color formatting
# Green for low usage, yellow for medium, red for high
if (( $(echo "$used_percent < 50" | bc -l) )); then
    color="\033[38;5;154m"  # Green
elif (( $(echo "$used_percent < 80" | bc -l) )); then
    color="\033[38;5;226m"  # Yellow
else
    color="\033[38;5;196m"  # Red
fi

reset="\033[0m"
dim="\033[2m"

# Output the status line
printf "${dim}${model_name} ${color}${progress_bar}${reset}${dim} ${used_percent}%%${reset}\n"
