import { Mic, MicOff, Paperclip, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function ChatComposer({
  onSend,
  onAttach,
  disabled,
  suggestedQuestions = [],
  language = "English",
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);
  const baseTextRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language === "English" ? "en-IN" : "en-IN";

    recognition.onstart = () => {
      setListening(true);
      setVoiceError("");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += text;
        else interimText += text;
      }
      const base = baseTextRef.current.trim();
      const separator = base ? " " : "";
      if (finalText) {
        const next = `${base}${separator}${finalText}`.trim();
        setValue(next);
        baseTextRef.current = next;
      } else if (interimText) {
        setValue(`${base}${separator}${interimText}`.trim());
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") setVoiceError("Microphone permission was blocked. Allow microphone access in Chrome.");
      else if (event.error === "no-speech") setVoiceError("No speech detected. Please try again.");
      else setVoiceError("Voice input could not be started. Please try again.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [language]);

  function submitMessage(event) {
    event.preventDefault();
    const message = value.trim();
    if (!message || disabled) return;
    if (listening) recognitionRef.current?.stop();
    onSend(message);
    setValue("");
    baseTextRef.current = "";
    setVoiceError("");
  }

  function toggleVoice() {
    if (disabled) return;
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError("Voice input is not supported in this browser. Use Google Chrome or Microsoft Edge.");
      return;
    }
    if (listening) {
      recognition.stop();
      return;
    }
    baseTextRef.current = value.trim();
    setVoiceError("");
    try { recognition.start(); } catch { setVoiceError("Voice input is already active. Please try again."); }
  }

  return (
    <div className="cs-chat-composer">
      <div className="cs-chat-composer__suggestions">
        {suggestedQuestions.map((question) => (
          <button key={question} type="button" onClick={() => onSend(question)} disabled={disabled}>{question}</button>
        ))}
      </div>

      {voiceError ? <div className="cs-chat-composer__voice-error">{voiceError}</div> : null}

      <form onSubmit={submitMessage} className="cs-chat-composer__form">
        <button type="button" className="cs-icon-button" aria-label="Attach document" title="Attach document" onClick={onAttach} disabled={disabled}>
          <Paperclip size={16} />
        </button>
        <input
          value={value}
          onChange={(event) => { setValue(event.target.value); baseTextRef.current = event.target.value; }}
          placeholder={listening ? "Listening..." : "Type your question here..."}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className={`cs-icon-button ${listening ? "cs-icon-button--voice-active" : ""}`}
          aria-label={listening ? "Stop voice input" : "Voice input"}
          title={listening ? "Stop voice input" : "Voice input"}
          onClick={toggleVoice}
          disabled={disabled}
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button type="submit" className="cs-send-button" disabled={disabled || !value.trim()} aria-label="Send message">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
