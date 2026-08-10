"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ElectionDayCallItem, ElectionDayWebrtcConfig } from "@pics-nigeria/shared";
import {
  ApiError,
  acceptElectionDayCall,
  endElectionDayCall,
  fetchElectionDayCalls,
  fetchElectionDayWebrtcConfig,
  initiateElectionDayCall,
  rejectElectionDayCall,
} from "../lib/api";

type Props = {
  token: string;
  /** Contacts the signed-in user is permitted to call. */
  contacts: Array<{ userId: string; name: string; role?: string }>;
};

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "—";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function statusLabel(call: ElectionDayCallItem) {
  if (call.status === "ENDED") {
    return call.endReason === "MISSED"
      ? "Missed"
      : call.endReason === "REJECTED"
        ? "Declined"
        : call.endReason === "CANCELLED"
          ? "Cancelled"
          : "Completed";
  }
  return call.status === "CONNECTED" ? "Connected" : "Ringing";
}

/**
 * Election Day voice calling surface (Feature 111).
 *
 * Lifecycle transitions are owned by the REST API, which holds the durable call
 * record. This component reflects that state and drives the local WebRTC peer
 * connection; it never invents a status of its own, so what an officer sees
 * always matches what PostgreSQL recorded.
 *
 * Calls are never recorded. No media is captured or uploaded anywhere.
 */
export function VoiceCallPanel({ token, contacts }: Props) {
  const [config, setConfig] = useState<ElectionDayWebrtcConfig | null>(null);
  const [calls, setCalls] = useState<ElectionDayCallItem[]>([]);
  const [activeCall, setActiveCall] = useState<ElectionDayCallItem | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const history = await fetchElectionDayCalls(token, { limit: 20 });
      setCalls(history);
      const live = history.find((call) => call.status !== "ENDED") || null;
      setActiveCall(live);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Call history could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void (async () => {
      try {
        setConfig(await fetchElectionDayWebrtcConfig(token));
      } catch {
        // A missing ICE configuration disables calling but must not break the
        // surrounding operations view.
      }
      await refresh();
    })();
  }, [token, refresh]);

  /** Releases the microphone and peer connection. Always safe to call twice. */
  const teardownMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  useEffect(() => teardownMedia, [teardownMedia]);

  const openMicrophone = useCallback(async () => {
    if (!config) {
      throw new Error("Call configuration is unavailable.");
    }
    // Permission is requested only when a call actually starts, never on load.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    const peer = new RTCPeerConnection({ iceServers: config.iceServers });
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };
    peerRef.current = peer;
    return peer;
  }, [config]);

  const startCall = useCallback(async () => {
    if (!targetUserId) {
      setError("Choose someone to call.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await openMicrophone();
      const call = await initiateElectionDayCall(token, { targetUserId });
      setActiveCall(call);
      await refresh();
    } catch (caught) {
      teardownMedia();
      setError(caught instanceof ApiError ? caught.message : "The call could not be started.");
    } finally {
      setBusy(false);
    }
  }, [targetUserId, token, openMicrophone, refresh, teardownMedia]);

  const answerCall = useCallback(async () => {
    if (!activeCall) return;
    setBusy(true);
    try {
      await openMicrophone();
      setActiveCall(await acceptElectionDayCall(token, activeCall.id));
      await refresh();
    } catch (caught) {
      teardownMedia();
      setError(caught instanceof ApiError ? caught.message : "The call could not be answered.");
    } finally {
      setBusy(false);
    }
  }, [activeCall, token, openMicrophone, refresh, teardownMedia]);

  const declineCall = useCallback(async () => {
    if (!activeCall) return;
    setBusy(true);
    try {
      await rejectElectionDayCall(token, activeCall.id);
      teardownMedia();
      setActiveCall(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The call could not be declined.");
    } finally {
      setBusy(false);
    }
  }, [activeCall, token, refresh, teardownMedia]);

  const hangUp = useCallback(async () => {
    if (!activeCall) return;
    setBusy(true);
    try {
      await endElectionDayCall(token, activeCall.id, "COMPLETED");
      teardownMedia();
      setActiveCall(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The call could not be ended.");
    } finally {
      setBusy(false);
    }
  }, [activeCall, token, refresh, teardownMedia]);

  const callable = contacts.filter((contact) => contact.userId);

  return (
    <section className="call-panel" aria-label="Election Day voice calling">
      <div className="call-panel-head">
        <h2>Voice</h2>
        <span className="call-recording-note">Calls are never recorded</span>
      </div>

      {error ? <p className="call-error">{error}</p> : null}

      {config && !config.turnConfigured ? (
        <p className="call-warning">
          No TURN relay is configured. Calls may not connect for devices on restrictive mobile networks.
        </p>
      ) : null}

      {activeCall ? (
        <div className="call-active">
          <p className="call-active-status">{statusLabel(activeCall)}</p>
          <p className="call-active-party">
            {activeCall.participants.map((participant) => participant.name).join(" ↔ ")}
          </p>
          <div className="call-actions">
            {activeCall.status === "RINGING" && activeCall.initiatorUserId !== activeCall.participants.find((p) => !p.isInitiator)?.userId ? (
              <>
                <button type="button" className="call-accept" onClick={() => void answerCall()} disabled={busy}>
                  Answer
                </button>
                <button type="button" className="call-decline" onClick={() => void declineCall()} disabled={busy}>
                  Decline
                </button>
              </>
            ) : null}
            <button type="button" className="call-end" onClick={() => void hangUp()} disabled={busy}>
              {activeCall.status === "CONNECTED" ? "Hang up" : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <div className="call-start">
          <label className="call-select">
            Call
            <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
              <option value="">Select a contact…</option>
              {callable.map((contact) => (
                <option key={contact.userId} value={contact.userId}>
                  {contact.name}
                  {contact.role ? ` · ${contact.role.replace(/_/g, " ")}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="call-start-button" onClick={() => void startCall()} disabled={busy || !targetUserId}>
            Start call
          </button>
        </div>
      )}

      {/* Remote audio sink. Muted locally until a track arrives. */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <h3 className="call-history-title">Recent calls</h3>
      {calls.length === 0 ? (
        <p className="call-empty">No calls yet.</p>
      ) : (
        <ul className="call-history">
          {calls.map((call) => (
            <li key={call.id}>
              <span className={`call-status call-status-${call.endReason?.toLowerCase() || call.status.toLowerCase()}`}>
                {statusLabel(call)}
              </span>
              <span className="call-history-party">
                {call.participants.map((participant) => participant.name).join(" ↔ ")}
              </span>
              <span className="call-history-meta">
                {new Date(call.startedAt).toLocaleString()} · {formatDuration(call.durationSeconds)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
