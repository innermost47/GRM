"""Timescape tracker solution (Wiltshire, arXiv 1311.3787, Eqs. 48-55):
what a clock in a dense region (wall time) measures versus the volume average."""
import math

GYR_S = 3.15576e16
KMSMPC = 1e3 / 3.0857e22          # km/s/Mpc -> s^-1


def tracker(fv0, tau0_gyr):
    om0 = 0.5 * (1 - fv0) * (2 + fv0)                       # dressed matter density today
    def wall_time(t, hbar0):                                  # Eq. (55)
        return 2 / 3 * t + 4 * om0 / (27 * fv0 * hbar0) * math.log(1 + 9 * fv0 * hbar0 * t / (4 * om0))
    # today: fv(t0) = fv0, so Hbar0 = (2 + fv0) / (3 t0); solve wall_time(t0) = tau0
    lo, hi = 1e9 * GYR_S / 1e9, 40 * GYR_S
    tau0 = tau0_gyr * GYR_S
    for _ in range(200):
        t0 = (lo + hi) / 2
        hbar0 = (2 + fv0) / (3 * t0)
        if wall_time(t0, hbar0) < tau0:
            lo = t0
        else:
            hi = t0
    hbar0 = (2 + fv0) / (3 * t0)
    h_dressed = (4 * fv0 ** 2 + fv0 + 4) / (6 * t0)          # dressed H, inferred by wall observers
    lapse = 0.5 * (2 + fv0)                                   # phenomenological lapse
    return {
        "Omega_M0 (dressed)": om0,
        "volume-average age t0 (Gyr)": t0 / GYR_S,
        "wall-clock age tau0 (Gyr)": tau0_gyr,
        "bare H0 (km/s/Mpc)": hbar0 / KMSMPC,
        "dressed H0 (km/s/Mpc)": h_dressed / KMSMPC,
        "clock lapse (void / wall)": lapse,
        "dressed H0 x wall age": h_dressed * tau0,
        "bare H0 x average age": hbar0 * t0,
    }


if __name__ == "__main__":
    for fv0 in (0.695, 0.76):
        for tau in (13.5, 13.77):
            print(f"\nf_v0 = {fv0}, wall-clock age = {tau} Gyr")
            for k, v in tracker(fv0, tau).items():
                print(f"  {k:<30} {v:.3f}")
