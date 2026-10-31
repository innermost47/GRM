import gzip
import shutil
import os
import time
import tsplib95
import platform
import subprocess
import json
import numpy as np
import matplotlib.pyplot as plt


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


def get_tsplib_instance(instance_name="lin318"):
    filename = f"{instance_name}.tsp"
    gz_filename = f"{instance_name}.tsp.gz"
    if not os.path.exists(filename) and os.path.exists(gz_filename):
        with gzip.open(gz_filename, "rb") as f_in, open(filename, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
    if not os.path.exists(filename) and not os.path.exists(gz_filename):
        url = f"https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/tsp/{instance_name}.tsp.gz"
        try:
            import urllib.request

            urllib.request.urlretrieve(url, gz_filename)
            with gzip.open(gz_filename, "rb") as f_in, open(filename, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
        except Exception as e:
            print(f"[ERROR] Download failed: {e}")
            return None, 0, None, None
    problem = tsplib95.load(filename)
    nodes = list(problem.get_nodes())
    num_cities = len(nodes)
    matrix = np.zeros((num_cities, num_cities))
    for i, u in enumerate(nodes):
        for j, v in enumerate(nodes):
            matrix[i, j] = problem.get_weight(u, v)
    coords = []
    if problem.node_coords:
        for node in nodes:
            coords.append(problem.node_coords[node])
        coordinates = np.array(coords)
    else:
        coordinates = None
    return problem.name, num_cities, coordinates, matrix


def compute_candidate_lists(matrix, num_cities, k=30):
    candidate_lists = []
    for i in range(num_cities):
        sorted_neighbors = np.argsort(matrix[i])
        neighbors = [n for n in sorted_neighbors if n != i][:k]
        candidate_lists.append(neighbors)
    return candidate_lists


def apply_2opt(route, i, j):
    return route[:i] + route[i : j + 1][::-1] + route[j + 1 :]


def grm_candidate_list_solver(
    instance_name="lin318", num_iterations=1000000, alpha=0.005, k_neighbors=30, seed=42
):
    np.random.seed(seed)
    start_time = time.time()
    name, num_cities, coordinates, matrix = get_tsplib_instance(instance_name)
    if matrix is None:
        return
    print(
        f"[INFO] Initializing Candidate Lists (k={k_neighbors}) for '{instance_name}' ({num_cities} cities)..."
    )
    candidate_lists = compute_candidate_lists(matrix, num_cities, k=k_neighbors)
    structural_baseline = np.median(matrix[matrix > 0])
    current_route = [int(x) for x in np.random.permutation(num_cities)]

    def evaluate_grm_hybrid(route):
        route_distances = [
            matrix[route[idx]][route[(idx + 1) % num_cities]]
            for idx in range(num_cities)
        ]
        arr = np.array(route_distances, dtype=float)
        dist_sum = np.sum(arr)
        tension_sum = np.sum(np.abs(arr - structural_baseline))
        return dist_sum + (alpha * tension_sum), dist_sum, tension_sum

    current_score, current_dist, current_tension = evaluate_grm_hybrid(current_route)
    best_route = list(current_route)
    best_dist = current_dist
    best_tension = current_tension
    best_score = current_score
    initial_temp = 400.0
    temperature = initial_temp
    cooling_rate = 0.99999
    reheat_count = 0
    stagnation_counter = 0

    print(
        f"[INFO] Running Candidate-List Simulated Annealing ({num_iterations} iterations)..."
    )
    for iteration in range(num_iterations):
        idx_a = np.random.randint(0, num_cities)
        city_a = current_route[idx_a]
        candidates = candidate_lists[city_a]
        city_b = np.random.choice(candidates)
        try:
            idx_b = current_route.index(city_b)
        except ValueError:
            continue
        if idx_a == idx_b:
            continue
        i, j = sorted([idx_a, idx_b])
        if i == 0 and j == num_cities - 1:
            continue
        new_route = apply_2opt(current_route, i, j)
        new_score, new_dist, new_tension = evaluate_grm_hybrid(new_route)
        delta = new_score - current_score
        if delta < 0 or np.random.rand() < np.exp(-delta / max(temperature, 1e-8)):
            current_route = list(new_route)
            current_score = new_score
            current_dist = new_dist
            current_tension = new_tension
            if current_score < best_score:
                best_score = current_score
                best_dist = current_dist
                best_tension = current_tension
                best_route = list(new_route)
                stagnation_counter = 0
            else:
                stagnation_counter += 1
        else:
            stagnation_counter += 1
        temperature *= cooling_rate
        if stagnation_counter > 40000:
            temperature = initial_temp * 0.3
            stagnation_counter = 0
            reheat_count += 1

    print("[INFO] Executing safe final local 2-opt polish...")
    improved = True
    while improved:
        improved = False
        for i in range(num_cities - 2):
            for j in range(i + 2, num_cities):
                test_route = apply_2opt(best_route, i, j)
                _, test_dist, _ = evaluate_grm_hybrid(test_route)
                if test_dist < best_dist:
                    best_route = list(test_route)
                    best_dist = test_dist
                    improved = True

    end_time = time.time()
    elapsed_time = end_time - start_time
    known_optima = {"lin318": 42029}
    official_optimum = known_optima.get(instance_name, None)
    gap = (
        ((best_dist - official_optimum) / official_optimum) * 100
        if official_optimum
        else None
    )

    if coordinates is not None:
        plot_solution(
            coordinates, best_route, instance_name, best_dist, official_optimum, gap
        )

    specs = get_machine_specs()
    print(f"\n==================================================================")
    print(f"               PERFORMANCE & HARDWARE BENCHMARK REPORT             ")
    print(f"==================================================================")
    print(f"--- Machine Specs ---")
    for k, v in specs.items():
        print(f"  {k}: {v}")
    print(f"\n==================================================================")
    print(f"       SAFE CANDIDATE LISTS & 2-OPT POLISH BENCHMARK REPORT       ")
    print(f"==================================================================")
    print(f"Instance             : {instance_name}")
    print(f"Number of cities     : {num_cities}")
    print(f"Computation time     : {elapsed_time:.2f} seconds")
    print(f"Re-heatings          : {reheat_count}")
    print(f"Calculated distance  : {best_dist:.2f}")
    if official_optimum:
        print(f"World optimum        : {official_optimum}")
        print(f"Gap to optimum       : {gap:+.2f}%")
    print(f"==================================================================")


def plot_solution(coordinates, route, instance_name, distance, optimum, gap):
    plt.figure(figsize=(10, 10))
    route_coords = coordinates[route + [route[0]]]
    plt.plot(
        route_coords[:, 0],
        route_coords[:, 1],
        "teal",
        linewidth=0.8,
        alpha=0.8,
        label="GRM Trace",
    )
    plt.scatter(coordinates[:, 0], coordinates[:, 1], color="darkred", s=12, zorder=5)
    title_str = f"TSPLIB Candidate Lists - {instance_name}\nDistance: {distance:.2f}"
    if optimum:
        title_str += f" | Optimum: {optimum} (Gap: {gap:+.2f}%)"
    plt.title(title_str, fontsize=12)
    plt.grid(True, linestyle="--", alpha=0.5)
    output_filename = f"tsplib_{instance_name}_grm_candidate.png"
    plt.savefig(output_filename, dpi=300, bbox_inches="tight")
    plt.show()
    print(f"[SUCCESS] Visualization saved: {output_filename}")


if __name__ == "__main__":
    grm_candidate_list_solver(
        "lin318", num_iterations=1000000, alpha=0.005, k_neighbors=30
    )
