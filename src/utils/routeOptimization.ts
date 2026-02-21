// Algorithme d'optimisation de tournÃƒÂ©es - Nearest Neighbor (plus proche voisin)
// Version simple mais efficace pour un TMS professionnel

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface Stop {
  deliveryId: string;
  location: Location;
  duration: number; // minutes
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  timeWindow?: {
    start: Date;
    end: Date;
  };
}

interface OptimizedRoute {
  stops: {
    deliveryId: string;
    sequence: number;
    location: Location;
    estimatedArrival: Date;
    duration: number;
  }[];
  totalDistance: number;
  totalDuration: number;
  fuelCost: number;
}

// Calcul de distance entre deux points GPS (formule Haversine)
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Algorithme du plus proche voisin
export function optimizeRouteNearestNeighbor(
  startLocation: Location,
  stops: Stop[],
  startTime: Date,
  avgSpeed: number = 50 // km/h
): OptimizedRoute {
  if (stops.length === 0) {
    return {
      stops: [],
      totalDistance: 0,
      totalDuration: 0,
      fuelCost: 0
    };
  }

  const optimizedStops: OptimizedRoute['stops'] = [];
  const remaining = [...stops];
  let currentLocation = startLocation;
  let currentTime = new Date(startTime);
  let totalDistance = 0;
  let sequence = 1;

  // Trier d'abord par prioritÃƒÂ©
  remaining.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal'];
  });

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    // Trouver le point le plus proche
    for (let i = 0; i < remaining.length; i++) {
      const stop = remaining[i];
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        stop.location.lat,
        stop.location.lng
      );

      // VÃƒÂ©rifier fenÃƒÂªtre horaire si applicable
      if (stop.timeWindow) {
        const travelTime = (distance / avgSpeed) * 60; // minutes
        const arrivalTime = new Date(currentTime.getTime() + travelTime * 60000);
        
        if (arrivalTime > stop.timeWindow.end) {
          continue; // Skip si on arrive trop tard
        }
      }

      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    // Ajouter le point le plus proche
    const nextStop = remaining.splice(nearestIndex, 1)[0];
    const travelTime = (minDistance / avgSpeed) * 60; // minutes
    currentTime = new Date(currentTime.getTime() + travelTime * 60000);

    // VÃƒÂ©rifier fenÃƒÂªtre horaire et ajuster si nÃƒÂ©cessaire
    if (nextStop.timeWindow && currentTime < nextStop.timeWindow.start) {
      currentTime = new Date(nextStop.timeWindow.start);
    }

    optimizedStops.push({
      deliveryId: nextStop.deliveryId,
      sequence: sequence++,
      location: nextStop.location,
      estimatedArrival: new Date(currentTime),
      duration: nextStop.duration
    });

    // Ajouter le temps de service
    currentTime = new Date(currentTime.getTime() + nextStop.duration * 60000);
    totalDistance += minDistance;
    currentLocation = nextStop.location;
  }

  const totalDuration = (currentTime.getTime() - startTime.getTime()) / 60000; // minutes
  const fuelCost = totalDistance * 0.15; // 0.15Ã¢â€šÂ¬/km (moyenne diesel)

  return {
    stops: optimizedStops,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: Math.round(totalDuration),
    fuelCost: Math.round(fuelCost * 100) / 100
  };
}

// Algorithme gÃƒÂ©nÃƒÂ©tique (version simplifiÃƒÂ©e) pour optimisation avancÃƒÂ©e
export function optimizeRouteGenetic(
  startLocation: Location,
  stops: Stop[],
  startTime: Date,
  generations: number = 100,
  populationSize: number = 50
): OptimizedRoute {
  // Population initiale
  let population: Stop[][] = [];
  for (let i = 0; i < populationSize; i++) {
    population.push(shuffleArray([...stops]));
  }

  // Ãƒâ€°volution sur N gÃƒÂ©nÃƒÂ©rations
  for (let gen = 0; gen < generations; gen++) {
    // Calculer fitness (distance totale) pour chaque individu
    const fitness = population.map(route => {
      let distance = calculateDistance(
        startLocation.lat,
        startLocation.lng,
        route[0].location.lat,
        route[0].location.lng
      );

      for (let i = 0; i < route.length - 1; i++) {
        distance += calculateDistance(
          route[i].location.lat,
          route[i].location.lng,
          route[i + 1].location.lat,
          route[i + 1].location.lng
        );
      }

      return { route, distance };
    });

    // Trier par fitness (distance la plus courte)
    fitness.sort((a, b) => a.distance - b.distance);

    // SÃƒÂ©lection des meilleurs (ÃƒÂ©litisme)
    const nextGeneration: Stop[][] = [];
    const eliteCount = Math.floor(populationSize * 0.2);
    for (let i = 0; i < eliteCount; i++) {
      nextGeneration.push([...fitness[i].route]);
    }

    // Crossover et mutation
    while (nextGeneration.length < populationSize) {
      const parent1 = fitness[Math.floor(Math.random() * eliteCount)].route;
      const parent2 = fitness[Math.floor(Math.random() * eliteCount)].route;
      const child = crossover(parent1, parent2);
      
      if (Math.random() < 0.1) { // 10% chance de mutation
        mutate(child);
      }
      
      nextGeneration.push(child);
    }

    population = nextGeneration;
  }

  // Retourner la meilleure route
  const bestRoute = population[0];
  return buildRouteFromStops(startLocation, bestRoute, startTime);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function crossover(parent1: Stop[], parent2: Stop[]): Stop[] {
  const size = parent1.length;
  const start = Math.floor(Math.random() * size);
  const end = start + Math.floor(Math.random() * (size - start));
  
  const child: Stop[] = new Array(size);
  
  // Copier une section du parent1
  for (let i = start; i < end; i++) {
    child[i] = parent1[i];
  }
  
  // Remplir le reste avec parent2 dans l'ordre
  let currentIndex = 0;
  for (let i = 0; i < size; i++) {
    if (currentIndex === start) {
      currentIndex = end;
    }
    
    if (!child.includes(parent2[i])) {
      child[currentIndex++] = parent2[i];
    }
  }
  
  return child.filter(Boolean);
}

function mutate(route: Stop[]): void {
  const i = Math.floor(Math.random() * route.length);
  const j = Math.floor(Math.random() * route.length);
  [route[i], route[j]] = [route[j], route[i]];
}

function buildRouteFromStops(
  startLocation: Location,
  stops: Stop[],
  startTime: Date,
  avgSpeed: number = 50
): OptimizedRoute {
  const optimizedStops: OptimizedRoute['stops'] = [];
  let currentLocation = startLocation;
  let currentTime = new Date(startTime);
  let totalDistance = 0;

  stops.forEach((stop, index) => {
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      stop.location.lat,
      stop.location.lng
    );

    const travelTime = (distance / avgSpeed) * 60;
    currentTime = new Date(currentTime.getTime() + travelTime * 60000);

    optimizedStops.push({
      deliveryId: stop.deliveryId,
      sequence: index + 1,
      location: stop.location,
      estimatedArrival: new Date(currentTime),
      duration: stop.duration
    });

    currentTime = new Date(currentTime.getTime() + stop.duration * 60000);
    totalDistance += distance;
    currentLocation = stop.location;
  });

  const totalDuration = (currentTime.getTime() - startTime.getTime()) / 60000;
  const fuelCost = totalDistance * 0.15;

  return {
    stops: optimizedStops,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: Math.round(totalDuration),
    fuelCost: Math.round(fuelCost * 100) / 100
  };
}
