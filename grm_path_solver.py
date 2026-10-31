import gzip
import shutil
import os
import time
import math
import random
import platform
import subprocess
import json
import tsplib95
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

    matrix = [[0.0] * num_cities for _ in range(num_cities)]
    for i, u in enumerate(nodes):
        for j, v in enumerate(nodes):
            matrix[i][j] = float(problem.get_weight(u, v))

    coords = []
    if problem.node_coords:
        for node in nodes:
            coords.append(problem.node_coords[node])
    coordinates = coords if coords else None
    return problem.name, num_cities, coordinates, matrix


def compute_candidate_lists(matrix, num_cities, k=30):
    candidate_lists = []
    for i in range(num_cities):
        row = matrix[i]
        sorted_indices = sorted(range(num_cities), key=lambda x: row[x])
        neighbors = [n for n in sorted_indices if n != i][:k]
        candidate_lists.append(neighbors)
    return candidate_lists


def grm_delta_solver(
    instance_name="lin318",
    num_iterations=3000000,
    initial_alpha=0.01,
    k_neighbors=45,
    seed=42,
):
    random.seed(seed)
    start_time = time.time()
    name, num_cities, coordinates, matrix = get_tsplib_instance(instance_name)
    if matrix is None:
        return

    print(
        f"[INFO] Initializing Refined Fast O(1) Solver for '{instance_name}' ({num_cities} cities)..."
    )
    candidate_lists = compute_candidate_lists(matrix, num_cities, k=k_neighbors)

    all_weights = [
        matrix[i][j] for i in range(num_cities) for j in range(num_cities) if i != j
    ]
    all_weights.sort()
    structural_baseline = all_weights[len(all_weights) // 2]

    current_route = list(range(num_cities))
    random.shuffle(current_route)

    pos = [0] * num_cities
    for idx, node in enumerate(current_route):
        pos[node] = idx

    def compute_full_metrics(route):
        d_sum = 0.0
        t_sum = 0.0
        for idx in range(num_cities):
            u = route[idx]
            v = route[(idx + 1) % num_cities]
            d = matrix[u][v]
            d_sum += d
            t_sum += abs(d - structural_baseline)
        return d_sum, t_sum

    current_dist, current_tension = compute_full_metrics(current_route)
    best_route = list(current_route)
    best_dist = current_dist

    initial_temp = 400.0
    temperature = initial_temp
    cooling_rate = 0.999997
    stagnation_counter = 0

    print(
        f"[INFO] Running Deep O(1) Delta-Evaluated SA ({num_iterations} iterations)..."
    )

    for iteration in range(num_iterations):
        current_alpha = initial_alpha * (1.0 - (iteration / num_iterations))

        idx_a = random.randint(0, num_cities - 1)
        city_a = current_route[idx_a]
        city_b = random.choice(candidate_lists[city_a])
        idx_b = pos[city_b]

        if idx_a == idx_b:
            continue
        i, j = (idx_a, idx_b) if idx_a < idx_b else (idx_b, idx_a)
        if i == 0 and j == num_cities - 1:
            continue

        v_i_prev = current_route[i - 1] if i > 0 else current_route[num_cities - 1]
        v_i = current_route[i]
        v_j = current_route[j]
        v_j_next = current_route[j + 1] if j < num_cities - 1 else current_route[0]

        old_d = matrix[v_i_prev][v_i] + matrix[v_j][v_j_next]
        new_d = matrix[v_i_prev][v_j] + matrix[v_i][v_j_next]
        delta_dist = new_d - old_d

        old_t = abs(matrix[v_i_prev][v_i] - structural_baseline) + abs(
            matrix[v_j][v_j_next] - structural_baseline
        )
        new_t = abs(matrix[v_i_prev][v_j] - structural_baseline) + abs(
            matrix[v_i][v_j_next] - structural_baseline
        )
        delta_tension = new_t - old_t

        delta_score = delta_dist + (current_alpha * delta_tension)

        if delta_score < 0 or random.random() < math.exp(
            -delta_score / max(temperature, 1e-8)
        ):
            current_route[i : j + 1] = reversed(current_route[i : j + 1])
            for idx in range(i, j + 1):
                pos[current_route[idx]] = idx

            current_dist += delta_dist
            current_tension += delta_tension

            if current_dist < best_dist:
                best_dist = current_dist
                best_route = list(current_route)
                stagnation_counter = 0
            else:
                stagnation_counter += 1
        else:
            stagnation_counter += 1

        temperature *= cooling_rate

    end_time = time.time()
    elapsed_time = end_time - start_time
    known_optima = {
        "lin318": 42029,
        "pcb1173": 56892,
    }
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
    print(f"            PERFORMANCE & HARDWARE BENCHMARK REPORT              ")
    print(f"==================================================================")
    print(f"--- Machine Specs ---")
    for k, v in specs.items():
        print(f"  {k}: {v}")
    print(f"\n==================================================================")
    print(f"      REFINED FAST O(1) DELTA PRECISION BENCHMARK REPORT          ")
    print(f"==================================================================")
    print(f"Instance             : {instance_name}")
    print(f"Number of cities     : {num_cities}")
    print(f"Computation time     : {elapsed_time:.2f} seconds")
    print(f"Calculated distance  : {best_dist:.2f}")
    if official_optimum:
        print(f"World optimum        : {official_optimum}")
        print(f"Gap to optimum       : {gap:+.2f}%")
    print(f"==================================================================")


def plot_solution(coordinates, route, instance_name, distance, optimum, gap):
    plt.figure(figsize=(10, 10))
    route_indices = route + [route[0]]
    rx = [coordinates[idx][0] for idx in route_indices]
    ry = [coordinates[idx][1] for idx in route_indices]
    cx = [coords[0] for coords in coordinates]
    cy = [coords[1] for coords in coordinates]

    plt.plot(rx, ry, "teal", linewidth=0.8, alpha=0.8, label="GRM Trace")
    plt.scatter(cx, cy, color="darkred", s=12, zorder=5)

    title_str = f"TSPLIB Refined Fast O(1) - {instance_name}\nDistance: {distance:.2f}"
    if optimum:
        title_str += f" | Optimum: {optimum} (Gap: {gap:+.2f}%)"
    plt.title(title_str, fontsize=12)
    plt.grid(True, linestyle="--", alpha=0.5)
    output_filename = f"tsplib_{instance_name}_grm_candidate.png"
    plt.savefig(output_filename, dpi=300, bbox_inches="tight")
    plt.show()
    print(f"[SUCCESS] Visualization saved: {output_filename}")


if __name__ == "__main__":
    grm_delta_solver(
        "lin318", num_iterations=3000000, initial_alpha=0.05, k_neighbors=45, seed=123
    )
