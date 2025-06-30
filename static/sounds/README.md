# Audio Files for PR Achievements

This directory contains audio files that play when users achieve personal records or milestones.

## Required Audio Files

1. **pr-achievement.mp3** - Plays when a user achieves a new personal record (weight, reps, or volume)
2. **milestone.mp3** - Plays when a user sets or reaches a milestone
3. **streak.mp3** - Plays when a user achieves a workout streak (future feature)

## Audio File Requirements

- **Format**: MP3 (recommended for best compatibility)
- **Duration**: 2-5 seconds (short and impactful)
- **Volume**: Normalized to avoid being too loud
- **Quality**: 128kbps or higher for good quality

## Where to Find Free Audio Files

1. **Freesound.org** - Free sound effects with Creative Commons licenses
2. **Zapsplat.com** - Free sound effects (requires free account)
3. **SoundBible.com** - Free sound effects
4. **YouTube Audio Library** - Free music and sound effects

## Suggested Audio Types

- **PR Achievement**: Triumphant fanfare, success chime, or achievement sound
- **Milestone**: Celebratory sound, bell chime, or accomplishment sound
- **Streak**: Motivational sound, fire crackle, or streak sound

## Testing the Audio Feature

1. Add the audio files to this directory
2. Log a workout that achieves a new personal record
3. The audio should play automatically
4. Check browser console for any audio-related errors

## Mobile Compatibility

The HTML5 Audio API works on all modern mobile browsers:
- iOS Safari (iOS 9+)
- Chrome Mobile
- Firefox Mobile
- Samsung Internet

## Troubleshooting

- **Audio doesn't play**: Check browser autoplay policies - user must interact with the page first
- **Audio files not found**: Ensure file paths are correct and files exist
- **Mobile issues**: Some mobile browsers require user interaction before playing audio
