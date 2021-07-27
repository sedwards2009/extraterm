/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { MinimalKeyboardEvent } from "term-api";
import {
  QKeyEvent,
  Modifier,
  Key,
} from "@nodegui/nodegui";


export function qKeyEventToMinimalKeyboardEvent(event: QKeyEvent): MinimalKeyboardEvent {
  const modifiers = event.modifiers();
  const altKey = (modifiers & Modifier.ALT) !== 0;
  const ctrlKey = (modifiers & Modifier.CTRL) !== 0;
  const metaKey = (modifiers & Modifier.META) !== 0;
  const shiftKey = (modifiers & Modifier.SHIFT) !== 0;

  const ev: MinimalKeyboardEvent = {
    altKey,
    ctrlKey,
    metaKey,
    shiftKey,
    key: mapQKeyEventToDOMKey(event),
    isComposing: false,
  };
  return ev;
}


const qkeyToDOMMapping = new Map<number, string>();
qkeyToDOMMapping.set(Key.Key_Alt, "Alt");
qkeyToDOMMapping.set(Key.Key_AltGr, "AltGraph");
qkeyToDOMMapping.set(Key.Key_Mode_switch, "AltGraph");
qkeyToDOMMapping.set(Key.Key_CapsLock, "CapsLock");
qkeyToDOMMapping.set(Key.Key_Control, "Control");
qkeyToDOMMapping.set(Key.Key_Meta, "Hyper");
qkeyToDOMMapping.set(Key.Key_NumLock, "NumLock");
qkeyToDOMMapping.set(Key.Key_ScrollLock, "ScrollLock");
qkeyToDOMMapping.set(Key.Key_Shift, "Shift");
qkeyToDOMMapping.set(Key.Key_Super_L, "Super");
qkeyToDOMMapping.set(Key.Key_Super_R, "Super");
qkeyToDOMMapping.set(Key.Key_Return, "Enter");
qkeyToDOMMapping.set(Key.Key_Enter, "Enter");
qkeyToDOMMapping.set(Key.Key_Tab, "Tab");
qkeyToDOMMapping.set(Key.Key_Space, " ");
qkeyToDOMMapping.set(Key.Key_Down, "ArrowDown");
qkeyToDOMMapping.set(Key.Key_Up, "ArrowUp");
qkeyToDOMMapping.set(Key.Key_Left, "ArrowLeft");
qkeyToDOMMapping.set(Key.Key_Right, "ArrowRight");
qkeyToDOMMapping.set(Key.Key_End, "End");
qkeyToDOMMapping.set(Key.Key_Home, "Home");
qkeyToDOMMapping.set(Key.Key_PageDown, "PageDown");
qkeyToDOMMapping.set(Key.Key_PageUp, "PageUp");
qkeyToDOMMapping.set(Key.Key_Backspace, "Backspace");
qkeyToDOMMapping.set(Key.Key_Clear, "Clear");
qkeyToDOMMapping.set(Key.Key_Copy, "Copy");
qkeyToDOMMapping.set(Key.Key_Cut, "Cut");
qkeyToDOMMapping.set(Key.Key_Delete, "Delete");
qkeyToDOMMapping.set(Key.Key_Insert, "Insert");
qkeyToDOMMapping.set(Key.Key_Paste, "Paste");
qkeyToDOMMapping.set(Key.Key_Menu, "ContextMenu");
qkeyToDOMMapping.set(Key.Key_Escape, "Escape");
qkeyToDOMMapping.set(Key.Key_Help, "Help");
qkeyToDOMMapping.set(Key.Key_Pause, "Pause");
qkeyToDOMMapping.set(Key.Key_Play, "Play");
qkeyToDOMMapping.set(Key.Key_ZoomIn, "ZoomIn");
qkeyToDOMMapping.set(Key.Key_ZoomOut, "ZoomOut");
qkeyToDOMMapping.set(Key.Key_MonBrightnessDown, "BrightnessDown");
qkeyToDOMMapping.set(Key.Key_MonBrightnessUp, "BrightnessUp");
qkeyToDOMMapping.set(Key.Key_Eject, "Eject");
qkeyToDOMMapping.set(Key.Key_LogOff, "LogOff");
qkeyToDOMMapping.set(Key.Key_PowerDown, "PowerOff");
qkeyToDOMMapping.set(Key.Key_PowerOff, "PowerOff");
qkeyToDOMMapping.set(Key.Key_Print, "PrintScreen");
qkeyToDOMMapping.set(Key.Key_SysReq, "PrintScreen");
qkeyToDOMMapping.set(Key.Key_Hibernate, "Hibernate");
qkeyToDOMMapping.set(Key.Key_Standby, "Standby");
qkeyToDOMMapping.set(Key.Key_Suspend, "Standby");
qkeyToDOMMapping.set(Key.Key_Sleep, "Standby");
qkeyToDOMMapping.set(Key.Key_WakeUp, "WakeUp");
qkeyToDOMMapping.set(Key.Key_MultipleCandidate, "AllCandidates");
qkeyToDOMMapping.set(Key.Key_Eisu_Shift, "Alphanumeric");
qkeyToDOMMapping.set(Key.Key_Eisu_toggle, "Alphanumeric");
qkeyToDOMMapping.set(Key.Key_Codeinput, "CodeInput");
qkeyToDOMMapping.set(Key.Key_Multi_key, "Compose");
qkeyToDOMMapping.set(Key.Key_Henkan, "Convert");
qkeyToDOMMapping.set(Key.Key_Mode_switch, "ModeChange");
qkeyToDOMMapping.set(Key.Key_Muhenkan, "NonConvert");
qkeyToDOMMapping.set(Key.Key_PreviousCandidate, " PreviousCandidate");
qkeyToDOMMapping.set(Key.Key_SingleCandidate, "SingleCandidate");
qkeyToDOMMapping.set(Key.Key_F1, "F1");
qkeyToDOMMapping.set(Key.Key_F2, "F2");
qkeyToDOMMapping.set(Key.Key_F3, "F3");
qkeyToDOMMapping.set(Key.Key_F4, "F4");
qkeyToDOMMapping.set(Key.Key_F5, "F5");
qkeyToDOMMapping.set(Key.Key_F6, "F6");
qkeyToDOMMapping.set(Key.Key_F7, "F7");
qkeyToDOMMapping.set(Key.Key_F8, "F8");
qkeyToDOMMapping.set(Key.Key_F9, "F9");
qkeyToDOMMapping.set(Key.Key_F10, "F10");
qkeyToDOMMapping.set(Key.Key_F11, "F11");
qkeyToDOMMapping.set(Key.Key_F12, "F12");
qkeyToDOMMapping.set(Key.Key_F13, "F13");
qkeyToDOMMapping.set(Key.Key_F14, "F14");
qkeyToDOMMapping.set(Key.Key_F15, "F15");
qkeyToDOMMapping.set(Key.Key_F16, "F16");
qkeyToDOMMapping.set(Key.Key_F17, "F17");
qkeyToDOMMapping.set(Key.Key_F18, "F18");
qkeyToDOMMapping.set(Key.Key_F19, "F19");
qkeyToDOMMapping.set(Key.Key_F20, "F20");
qkeyToDOMMapping.set(Key.Key_Context1, "Soft1");
qkeyToDOMMapping.set(Key.Key_Context2, "Soft2");
qkeyToDOMMapping.set(Key.Key_Context3, "Soft3");
qkeyToDOMMapping.set(Key.Key_Context4, "Soft4");
qkeyToDOMMapping.set(Key.Key_ChannelDown, "ChannelDown");
qkeyToDOMMapping.set(Key.Key_ChannelUp, "ChannelUp");
qkeyToDOMMapping.set(Key.Key_AudioForward, "MediaFastForward");
qkeyToDOMMapping.set(Key.Key_MediaPause, "MediaPause");
qkeyToDOMMapping.set(Key.Key_MediaTogglePlayPause, "MediaPlayPause");
qkeyToDOMMapping.set(Key.Key_MediaRecord, "MediaRecord");
qkeyToDOMMapping.set(Key.Key_AudioRewind, "MediaRewind");
qkeyToDOMMapping.set(Key.Key_MediaStop, "MediaStop");
qkeyToDOMMapping.set(Key.Key_MediaNext, "MediaTrackNext");
qkeyToDOMMapping.set(Key.Key_MediaPrevious, "MediaTrackPrevious");
qkeyToDOMMapping.set(Key.Key_VolumeDown, "AudioVolumeDown");
qkeyToDOMMapping.set(Key.Key_VolumeMute, "AudioVolumeMute");
qkeyToDOMMapping.set(Key.Key_VolumeUp, "AudioVolumeUp");
qkeyToDOMMapping.set(Key.Key_MicVolumeDown, "MicrophoneVolumeDown");
qkeyToDOMMapping.set(Key.Key_MicMute, "MicrophoneVolumeMute");
qkeyToDOMMapping.set(Key.Key_MicVolumeUp, "MicrophoneVolumeUp");
qkeyToDOMMapping.set(Key.Key_Exit, "Exit");
qkeyToDOMMapping.set(Key.Key_Guide, "Guide");
qkeyToDOMMapping.set(Key.Key_Info, "Info");
qkeyToDOMMapping.set(Key.Key_AudioCycleTrack, "MediaAudioTrack");
qkeyToDOMMapping.set(Key.Key_MediaLast, "MediaLast");
qkeyToDOMMapping.set(Key.Key_TopMenu, "MediaTopMenu");
qkeyToDOMMapping.set(Key.Key_Settings, "Settings");
qkeyToDOMMapping.set(Key.Key_SplitScreen, "SplitScreenToggle");
qkeyToDOMMapping.set(Key.Key_Zoom, "ZoomToggle");
qkeyToDOMMapping.set(Key.Key_Close, "Close");
qkeyToDOMMapping.set(Key.Key_New, "New");
qkeyToDOMMapping.set(Key.Key_Open, "Open");
qkeyToDOMMapping.set(Key.Key_Print, "Print");
qkeyToDOMMapping.set(Key.Key_Save, "Save");
qkeyToDOMMapping.set(Key.Key_Spell, "SpellCheck");
qkeyToDOMMapping.set(Key.Key_MailForward, "MailForward");
qkeyToDOMMapping.set(Key.Key_Reply, "MailReply");
qkeyToDOMMapping.set(Key.Key_Calculator, "LaunchCalculator");
qkeyToDOMMapping.set(Key.Key_Calendar, "LaunchCalendar");
qkeyToDOMMapping.set(Key.Key_LaunchMail, "LaunchMail");
qkeyToDOMMapping.set(Key.Key_LaunchMedia, "LaunchMediaPlayer");
qkeyToDOMMapping.set(Key.Key_Music, "LaunchMusicPlayer");
qkeyToDOMMapping.set(Key.Key_Phone, "LaunchPhone");
qkeyToDOMMapping.set(Key.Key_ScreenSaver, "LaunchScreenSaver");
qkeyToDOMMapping.set(Key.Key_Excel, "LaunchSpreadsheet");
qkeyToDOMMapping.set(Key.Key_WWW, "LaunchWebBrowser");
qkeyToDOMMapping.set(Key.Key_WebCam, "LaunchWebCam");
qkeyToDOMMapping.set(Key.Key_Word, "LaunchWordProcessor");
qkeyToDOMMapping.set(Key.Key_Launch0, "LaunchApplication1");
qkeyToDOMMapping.set(Key.Key_Launch1, "LaunchApplication2");
qkeyToDOMMapping.set(Key.Key_Launch2, "LaunchApplication3");
qkeyToDOMMapping.set(Key.Key_Launch3, "LaunchApplication4");
qkeyToDOMMapping.set(Key.Key_Launch4, "LaunchApplication5");
qkeyToDOMMapping.set(Key.Key_Launch5, "LaunchApplication6");
qkeyToDOMMapping.set(Key.Key_Launch6, "LaunchApplication7");
qkeyToDOMMapping.set(Key.Key_Launch7, "LaunchApplication8");
qkeyToDOMMapping.set(Key.Key_Launch8, "LaunchApplication9");
qkeyToDOMMapping.set(Key.Key_Launch9, "LaunchApplication10");
qkeyToDOMMapping.set(Key.Key_LaunchA, "LaunchApplication11");
qkeyToDOMMapping.set(Key.Key_LaunchB, "LaunchApplication12");
qkeyToDOMMapping.set(Key.Key_LaunchC, "LaunchApplication13");
qkeyToDOMMapping.set(Key.Key_LaunchD, "LaunchApplication14");
qkeyToDOMMapping.set(Key.Key_LaunchE, "LaunchApplication15");
qkeyToDOMMapping.set(Key.Key_LaunchF, "LaunchApplication16");
qkeyToDOMMapping.set(Key.Key_Back, "BrowserBack");
qkeyToDOMMapping.set(Key.Key_Favorites, "BrowserFavorites");
qkeyToDOMMapping.set(Key.Key_Forward, "BrowserForward");
qkeyToDOMMapping.set(Key.Key_HomePage, "BrowserHome");
qkeyToDOMMapping.set(Key.Key_Reload, "BrowserRefresh");
qkeyToDOMMapping.set(Key.Key_Search, "BrowserSearch");
qkeyToDOMMapping.set(Key.Key_Search, "BrowserStop");

function mapQKeyEventToDOMKey(ev: QKeyEvent): string {
  const key = ev.key();
  if (qkeyToDOMMapping.has(key)) {
    return qkeyToDOMMapping.get(key);
  }
  const text = ev.text();
  if ((text.charCodeAt(0) <= 31) && (key < 256)) {
    return String.fromCodePoint(key);
  }
  return text;
}
