// Telnyx's documented STUN/TURN infrastructure, hardcoded per Telnyx's own
// network-configuration guide (developers.telnyx.com — "Network Connectivity
// Requirements"). @telnyx/webrtc ships these as named constants rather than
// raw strings, since TURN needs per-session credentials that Telnyx issues
// alongside the login_token — hardcoding a static username/password here
// would be both wrong and a security smell. Using the SDK's own constants
// gives us the real hardcoded hostnames Telnyx wants:
//   STUN        stun.telnyx.com:3478
//   TURN (UDP)  turn.telnyx.com:3478
//   TURNS (TCP/443) turn2.telnyx.com:443  <- the one that gets through
//                    strict corporate firewalls that block everything but 443
import { TELNYX_ICE_SERVERS } from "@telnyx/webrtc";

export const TELNYX_RTC_ICE_SERVERS = [
  TELNYX_ICE_SERVERS.TELNYX_STUN,
  TELNYX_ICE_SERVERS.TELNYX_TURN_UDP_3478,
  TELNYX_ICE_SERVERS.TELNYX_TURNS_TCP_443,
];
