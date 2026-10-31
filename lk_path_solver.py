import os
import time
import json
import subprocess
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
import platform
import tsplib95
import lk_heuristic
from lk_heuristic.utils.solver_funcs import solve

INSTANCE = "lin318"
TSP_FILE = f"{INSTANCE}.tsp"
OUTPUT_NAME = f"{INSTANCE}_lk_solved"
OUTPUT_IMAGE = f"tsplib_{INSTANCE}_lk2.png"
KNOWN_OPTIMUM = 42029


def get_machine_specs():
    specs = {
        "OS": f"{platform.system()} {platform.release()} ({platform.version()})",
        "Machine": platform.machine(),
        "Processor": platform.processor() or "Not specified",
        "CPU Cores (logical)": os.cpu_count(),
        "Architecture": platform.architecture()[0],
    }
    if platform.system() == "Windows":
        try:
            command = [
                "powershell",
                "-NoProfile",
                "-Command",
                """
                Get-CimInstance Win32_Processor |
                Select-Object Name, Manufacturer, NumberOfCores,
                              NumberOfLogicalProcessors, MaxClockSpeed |
                ConvertTo-Json -Compress
                """,
            ]
            result = subprocess.run(
                command, capture_output=True, text=True, timeout=10, check=True
            )
            cpu_data = json.loads(result.stdout)
            if isinstance(cpu_data, dict):
                cpu_data = [cpu_data]
            if cpu_data:
                cpu = cpu_data[0]
                specs.update(
                    {
                        "CPU Model": cpu.get("Name", "Not specified"),
                        "CPU Manufacturer": cpu.get("Manufacturer", "Not specified"),
                        "CPU Physical Cores": cpu.get("NumberOfCores", "Not specified"),
                        "CPU Logical Cores": cpu.get(
                            "NumberOfLogicalProcessors", "Not specified"
                        ),
                        "CPU Max Frequency (MHz)": cpu.get(
                            "MaxClockSpeed", "Not specified"
                        ),
                    }
                )
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
            specs["CPU Model"] = "Could not retrieve CPU details"
    return specs


def load_instance(filename):
    if not os.path.exists(filename):
        raise FileNotFoundError(f"TSPLIB instance not found: {filename}")
    problem = tsplib95.load(filename)
    nodes = list(problem.get_nodes())
    coordinates = np.array([problem.node_coords[node] for node in nodes], dtype=float)
    return problem, nodes, coordinates


def find_solution():
    print("[INFO] Searching for the file exported by LK2...")
    package_directory = Path(lk_heuristic.__file__).resolve().parent
    solutions_directory = package_directory / "solutions"
    filename = "lin318_lk_solved.tsp"
    solution_path = solutions_directory / filename
    print(f"[INFO] LK package: {package_directory}")
    print(f"[INFO] Solutions folder: {solutions_directory}")
    if solution_path.is_file():
        print(f"[SUCCESS] Solution found: {solution_path}")
        return solution_path
    if solutions_directory.exists():
        matches = list(solutions_directory.glob("lin318_lk_solved*.tsp"))
        if matches:
            print(f"[SUCCESS] Solution found: {matches[0]}")
            return matches[0]
        print("[DIAGNOSTIC] Available files:")
        for file in solutions_directory.iterdir():
            print(f" - {file.name}")
    else:
        print("[ERROR] The solutions folder is missing from the package.")
    raise FileNotFoundError(f"LK2 solution not found in {solutions_directory}")


def extract_route(solution_path, original_nodes):
    solution = tsplib95.load(str(solution_path))
    route_coords = np.array(list(solution.node_coords.values()), dtype=float)
    if len(route_coords) != len(original_nodes):
        raise ValueError(f"Incorrect number of cities: {len(route_coords)}")
    return route_coords


def calculate_distance(route_coords):
    closed_route = np.vstack([route_coords, route_coords[0]])
    distances = np.linalg.norm(np.diff(closed_route, axis=0), axis=1)
    return np.sum(distances)


def plot_solution(coordinates, distance, optimum, gap):
    plt.figure(figsize=(10, 10))
    closed_route = np.vstack([coordinates, coordinates[0]])
    plt.plot(
        closed_route[:, 0],
        closed_route[:, 1],
        "teal",
        linewidth=0.8,
        alpha=0.8,
        label="Lin-Kernighan 2 Trace",
    )
    plt.scatter(coordinates[:, 0], coordinates[:, 1], color="darkred", s=12, zorder=5)
    plt.title(
        f"TSPLIB Lin-Kernighan 2 - lin318\nDistance: {distance:.2f} | Optimum: {optimum} (Gap: {gap:+.2f}%)",
        fontsize=12,
    )
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.savefig(OUTPUT_IMAGE, dpi=300, bbox_inches="tight")
    plt.show()
    print(f"[SUCCESS] Visualization saved: {OUTPUT_IMAGE}")


def execute_lin_kernighan_benchmark():
    print("\n" + "=" * 66)
    print("       LIN-KERNIGHAN 2 — BENCHMARK")
    print("=" * 66)
    problem, nodes, coordinates = load_instance(TSP_FILE)
    num_cities = len(nodes)
    print(f"[INFO] Instance: {INSTANCE}")
    print(f"[INFO] Number of cities: {num_cities}")
    print("\n[INFO] Starting Lin-Kernighan 2 solver...")
    start_timestamp = time.perf_counter()
    solve(
        tsp_file=TSP_FILE,
        solution_method="lk2_improve",
        runs=1,
        backtracking=(5, 5),
        reduction_level=4,
        reduction_cycle=4,
        tour_type="cycle",
        file_name=OUTPUT_NAME,
        logging_level=20,
    )
    end_timestamp = time.perf_counter()
    total_execution_time = end_timestamp - start_timestamp
    solution_path = find_solution()
    route_coords = extract_route(solution_path, nodes)
    total_distance = calculate_distance(route_coords)
    gap = ((total_distance - KNOWN_OPTIMUM) / KNOWN_OPTIMUM) * 100
    plot_solution(route_coords, total_distance, KNOWN_OPTIMUM, gap)
    specs = get_machine_specs()
    print("\n" + "=" * 66)
    print("               PERFORMANCE & HARDWARE BENCHMARK REPORT             ")
    print("=" * 66)
    print("--- Machine Specs ---")
    for k, v in specs.items():
        print(f"  {k}: {v}")
    print("\n" + "=" * 66)
    print("       LIN-KERNIGHAN 2 BENCHMARK RESULTS")
    print("=" * 66)
    print(f"Instance             : {INSTANCE}")
    print(f"Number of cities     : {num_cities}")
    print(f"Execution time       : {total_execution_time:.2f} seconds")
    print(f"Calculated distance  : {total_distance:.2f}")
    print(f"World optimum        : {KNOWN_OPTIMUM}")
    print(f"Gap to optimum       : {gap:+.2f}%")
    print("=" * 66)


if __name__ == "__main__":
    execute_lin_kernighan_benchmark()
