// tsp.js - 路线优化算法（Haversine + 最近邻）

const RouteOptimizer = {
  // Haversine 公式：计算两点间直线距离（公里）
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // 最近邻算法：从第一个门店出发，每次去最近的未访问门店
  nearestNeighbor(stores) {
    if (stores.length <= 1) return { route: [...stores], totalDist: 0 };
    if (!stores[0].lat || !stores[0].lng) return { route: [...stores], totalDist: 0 };

    const unvisited = stores.map((s, i) => i);
    const route = [unvisited.shift()];
    let totalDist = 0;

    while (unvisited.length > 0) {
      const current = stores[route[route.length - 1]];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const candidate = stores[unvisited[i]];
        if (!candidate.lat || !candidate.lng) continue;
        const d = this.haversineDistance(current.lat, current.lng, candidate.lat, candidate.lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      totalDist += bestDist;
      route.push(unvisited.splice(bestIdx, 1)[0]);
    }

    return {
      route: route.map(i => stores[i]),
      totalDist: Math.round(totalDist * 10) / 10
    };
  },

  // 2-opt 局部优化：交换路径中两段，看能否更短
  optimize2opt(stores) {
    if (stores.length <= 3) return this.nearestNeighbor(stores);
    if (!stores[0].lat || !stores[0].lng) return { route: [...stores], totalDist: 0 };

    let route = stores.map((_, i) => i);
    let improved = true;
    let bestDist = this._calcTotalDist(route, stores);

    while (improved) {
      improved = false;
      for (let i = 1; i < route.length - 1; i++) {
        for (let j = i + 1; j < route.length; j++) {
          const newRoute = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
          const newDist = this._calcTotalDist(newRoute, stores);
          if (newDist < bestDist - 0.01) {
            route = newRoute;
            bestDist = newDist;
            improved = true;
          }
        }
      }
    }

    return {
      route: route.map(i => stores[i]),
      totalDist: Math.round(bestDist * 10) / 10
    };
  },

  _calcTotalDist(order, stores) {
    let total = 0;
    for (let i = 1; i < order.length; i++) {
      const a = stores[order[i - 1]], b = stores[order[i]];
      if (a.lat && a.lng && b.lat && b.lng) {
        total += this.haversineDistance(a.lat, a.lng, b.lat, b.lng);
      }
    }
    return total;
  },

  // 主入口：门店数 <=8 用 2-opt，否则用最近邻
  optimize(stores) {
    if (stores.length <= 1) return { route: [...stores], totalDist: 0 };
    const validStores = stores.filter(s => s.lat && s.lng);
    if (validStores.length < stores.length) {
      // 有门店没坐标，原序返回
      return { route: [...stores], totalDist: 0 };
    }
    return stores.length <= 8
      ? this.optimize2opt(stores)
      : this.nearestNeighbor(stores);
  }
};
