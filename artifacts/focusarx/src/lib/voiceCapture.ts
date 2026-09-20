export const OPEN_VOICE_CAPTURE_EVENT = "focusarx:open-voice-capture";

export function openVoiceCapture(transcript?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_VOICE_CAPTURE_EVENT, { detail: transcript ? { transcript } : undefined }));
}
