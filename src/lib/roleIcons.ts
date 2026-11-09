import { ClipboardList, DoorOpen, Monitor, Mic, Timer, Users } from "lucide-react";

const roleIcons = {
  Båsdörr: DoorOpen,
  "Båsdörr 1": DoorOpen,
  "Båsdörr 2": DoorOpen,
  OVR: Monitor,
  Klockan: Timer,
  Klocka: Timer,
  "Speaker/Musik": Mic,
  Matchvärd: Users,
};

export function roleIcon(role: string) {
  return roleIcons[role as keyof typeof roleIcons] || ClipboardList;
}
