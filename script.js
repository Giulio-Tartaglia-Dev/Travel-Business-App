class DigitalNomadPlanner {
    constructor() {
        this.countries = [];
        this.cities = [];
        this.allCities = [];
        this.homeCountry = '';
        this.monthlyBudget = 0;
        this.init();
    }

    async init() {
        await this.loadCountries();
        this.setupEventListeners();
        this.populateCountries();
    }

    setupEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const homeCountrySelect = document.getElementById('homeCountry');
        const budgetInput = document.getElementById('monthlyBudget');

        searchBtn.addEventListener('click', () => this.searchDestinations());
        
        budgetInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchDestinations();
        });
        
        homeCountrySelect.addEventListener('change', (e) => {
            this.homeCountry = e.target.value;
        });
        
        budgetInput.addEventListener('input', (e) => {
            this.monthlyBudget = parseInt(e.target.value) || 0;
        });
    }

    async loadCountries() {
        try {
            const response = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies,languages,cca2,cca3');
            this.countries = await response.json();
            this.countries.sort((a, b) => a.name.common.localeCompare(b.name.common));
        } catch (error) {
            console.error('Error loading countries:', error);
            this.showError('Failed to load countries. Please refresh the page.');
        }
    }

    populateCountries() {
        const select = document.getElementById('homeCountry');
        this.countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.cca2;
            option.textContent = country.name.common;
            select.appendChild(option);
        });
    }

    async searchDestinations() {
        const homeCountry = document.getElementById('homeCountry').value;
        const monthlyBudget = parseInt(document.getElementById('monthlyBudget').value);

        if (!homeCountry || !monthlyBudget || monthlyBudget < 500) {
            this.showError('Please select a home country and enter a valid monthly budget (minimum $500).');
            return;
        }

        this.showLoading();
        this.homeCountry = homeCountry;
        this.monthlyBudget = monthlyBudget;

        try {
            await this.loadAllCitiesData();
            this.filterAndDisplayCities();
            this.initMap();
        } catch (error) {
            console.error('Error searching destinations:', error);
            this.showError('Failed to search destinations. Please try again.');
        }
    }

    async loadAllCitiesData() {
        try {
           
            const [teleportCities, geonamesCities, restCities] = await Promise.allSettled([
                this.loadTeleportCities(),
                this.loadGeonamesCities(),
                this.loadRestWorldCities()
            ]);

         
            this.allCities = [
                ...(teleportCities.status === 'fulfilled' ? teleportCities.value : []),
                ...(geonamesCities.status === 'fulfilled' ? geonamesCities.value : []),
                ...(restCities.status === 'fulfilled' ? restCities.value : [])
            ];

          
            this.allCities = this.removeDuplicateCities(this.allCities);
            
            if (this.allCities.length === 0) {
                throw new Error('No city data available');
            }

            console.log(`Loaded ${this.allCities.length} cities from multiple sources`);
        } catch (error) {
            console.error('Error loading cities data:', error);
            this.loadFallbackData();
        }
    }

    async loadTeleportCities() {
        try {
            const response = await fetch('https://api.teleport.org/api/urban_areas/');
            const data = await response.json();
            
            const citiesPromises = data._links['ua:item'].slice(0, 50).map(async (cityLink) => {
                try {
                    const cityResponse = await fetch(cityLink.href);
                    const cityData = await cityResponse.json();
                    
                    const salariesResponse = await fetch(`${cityLink.href}salaries/`);
                    const salariesData = await salariesResponse.json();
                    
                    const scoresResponse = await fetch(`${cityLink.href}scores/`);
                    const scoresData = await scoresResponse.json();
                    
                    const coords = cityData.bounding_box.latlon;
                    const lat = (coords.north + coords.south) / 2;
                    const lng = (coords.east + coords.west) / 2;
                    
                    const avgSalary = this.calculateAverageSalary(salariesData);
                    const monthlyCost = Math.round(avgSalary * 0.6);
                    
                    return {
                        name: cityData.name,
                        country: this.extractCountryFromCity(cityData.name),
                        countryCode: this.getCountryCode(cityData.name),
                        lat: lat,
                        lng: lng,
                        monthlyCost: monthlyCost,
                        currency: this.getCurrency(cityData.name),
                        exchangeRate: this.getExchangeRate(cityData.name),
                        qualityOfLife: scoresData.teleport_city_score || 7.0,
                        internetSpeed: this.getInternetSpeed(cityData.name),
                        description: this.getCityDescription(cityData.name),
                        source: 'teleport'
                    };
                } catch (error) {
                    return null;
                }
            });
            
            const cities = await Promise.all(citiesPromises);
            return cities.filter(city => city !== null);
        } catch (error) {
            console.error('Teleport API error:', error);
            return [];
        }
    }

    async loadGeonamesCities() {
        try {
           
            const cities = [
                { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060 },
                { name: 'Los Angeles', country: 'United States', lat: 34.0522, lng: -118.2437 },
                { name: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298 },
                { name: 'Miami', country: 'United States', lat: 25.7617, lng: -80.1918 },
                { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
                { name: 'Vancouver', country: 'Canada', lat: 49.2827, lng: -123.1207 },
                { name: 'Montreal', country: 'Canada', lat: 45.5017, lng: -73.5673 },
                { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
                { name: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631 },
                { name: 'Brisbane', country: 'Australia', lat: -27.4698, lng: 153.0251 },
                { name: 'Auckland', country: 'New Zealand', lat: -36.8485, lng: 174.7633 },
                { name: 'Wellington', country: 'New Zealand', lat: -41.2865, lng: 174.7762 },
                { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
                { name: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4539, lng: 54.3773 },
                { name: 'Doha', country: 'Qatar', lat: 25.2854, lng: 51.5310 },
                { name: 'Kuwait City', country: 'Kuwait', lat: 29.3759, lng: 47.9774 },
                { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lng: 46.6753 },
                { name: 'Tel Aviv', country: 'Israel', lat: 32.0853, lng: 34.7818 },
                { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
                { name: 'Moscow', country: 'Russia', lat: 55.7558, lng: 37.6173 }
            ];

            return cities.map(city => ({
                ...city,
                monthlyCost: this.estimateCostByCity(city.name, city.country),
                currency: this.getCurrency(city.name),
                exchangeRate: this.getExchangeRate(city.name),
                qualityOfLife: this.estimateQualityByCity(city.name),
                internetSpeed: this.getInternetSpeed(city.name),
                description: this.getCityDescription(city.name),
                source: 'geonames'
            }));
        } catch (error) {
            console.error('Geonames error:', error);
            return [];
        }
    }

    async loadRestWorldCities() {
        try {
            
            const cities = [
                { name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357 },
                { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 },
                { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219 },
                { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473 },
                { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241 },
                { name: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777 },
                { name: 'Delhi', country: 'India', lat: 28.7041, lng: 77.1025 },
                { name: 'Bangalore', country: 'India', lat: 12.9716, lng: 77.5946 },
                { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
                { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1390, lng: 101.6869 },
                { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456 },
                { name: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842 },
                { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
                { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lng: 106.6297 },
                { name: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737 },
                { name: 'Beijing', country: 'China', lat: 39.9042, lng: 116.4074 },
                { name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
                { name: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.9780 },
                { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
                { name: 'Osaka', country: 'Japan', lat: 34.6937, lng: 135.5023 }
            ];

            return cities.map(city => ({
                ...city,
                monthlyCost: this.estimateCostByCity(city.name, city.country),
                currency: this.getCurrency(city.name),
                exchangeRate: this.getExchangeRate(city.name),
                qualityOfLife: this.estimateQualityByCity(city.name),
                internetSpeed: this.getInternetSpeed(city.name),
                description: this.getCityDescription(city.name),
                source: 'restworld'
            }));
        } catch (error) {
            console.error('Rest world cities error:', error);
            return [];
        }
    }

    removeDuplicateCities(cities) {
        const seen = new Set();
        return cities.filter(city => {
            const key = `${city.name.toLowerCase()}-${city.country.toLowerCase()}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    estimateCostByCity(cityName, country) {
      
        const costMap = {
            'New York': 3500, 'San Francisco': 3200, 'Los Angeles': 2800, 'Chicago': 2200,
            'Toronto': 2400, 'Vancouver': 2600, 'Montreal': 1800,
            'London': 3000, 'Paris': 2800, 'Berlin': 2000, 'Amsterdam': 2500,
            'Tokyo': 2700, 'Seoul': 2200, 'Singapore': 2800, 'Hong Kong': 3000,
            'Sydney': 2600, 'Melbourne': 2200, 'Auckland': 2000,
            'Dubai': 2400, 'Abu Dhabi': 2000, 'Doha': 2200,
            'Mumbai': 800, 'Delhi': 700, 'Bangalore': 600,
            'Bangkok': 900, 'Ho Chi Minh City': 700, 'Jakarta': 600,
            'Manila': 700, 'Kuala Lumpur': 1000,
            'Cairo': 600, 'Lagos': 500, 'Nairobi': 700,
            'Johannesburg': 900, 'Cape Town': 1000,
            'Moscow': 1200, 'Istanbul': 1000, 'Tel Aviv': 2000
        };
        
        return costMap[cityName] || 1500; 
    }

    estimateQualityByCity(cityName) {
        const qualityMap = {
            'Tokyo': 8.8, 'Singapore': 8.7, 'Vienna': 8.6, 'Zurich': 8.5,
            'London': 8.2, 'Paris': 8.1, 'Berlin': 8.0, 'Amsterdam': 8.3,
            'Sydney': 8.4, 'Melbourne': 8.2, 'Auckland': 8.1,
            'Toronto': 8.0, 'Vancouver': 8.3, 'Montreal': 7.8,
            'Dubai': 7.9, 'Abu Dhabi': 7.7, 'Doha': 7.6,
            'Seoul': 8.1, 'Hong Kong': 7.9,
            'Bangkok': 7.2, 'Ho Chi Minh City': 6.9, 'Jakarta': 6.8,
            'Manila': 6.7, 'Kuala Lumpur': 7.3,
            'Mumbai': 6.5, 'Delhi': 6.3, 'Bangalore': 6.7,
            'Cairo': 6.2, 'Lagos': 5.8, 'Nairobi': 6.4,
            'Johannesburg': 6.8, 'Cape Town': 7.1,
            'Moscow': 7.0, 'Istanbul': 7.1, 'Tel Aviv': 7.8
        };
        
        return qualityMap[cityName] || 7.0; 
    }
    
    calculateAverageSalary(salariesData) {
        if (!salariesData.salaries || salariesData.salaries.length === 0) {
            return 2500;
        }
        
        const techJobs = salariesData.salaries.filter(job => 
            job.job.title.toLowerCase().includes('software') ||
            job.job.title.toLowerCase().includes('developer') ||
            job.job.title.toLowerCase().includes('it')
        );
        
        if (techJobs.length > 0) {
            return techJobs.reduce((sum, job) => sum + job.salary_percentiles.percentile_50, 0) / techJobs.length;
        }
        
        return salariesData.salaries.reduce((sum, job) => sum + job.salary_percentiles.percentile_50, 0) / salariesData.salaries.length;
    }
    
    extractCountryFromCity(cityName) {
        const countryMap = {
            'Bangkok': 'Thailand', 'Lisbon': 'Portugal', 'Mexico City': 'Mexico',
            'Bali': 'Indonesia', 'Barcelona': 'Spain', 'Ho Chi Minh City': 'Vietnam',
            'Prague': 'Czech Republic', 'Medellín': 'Colombia', 'Berlin': 'Germany',
            'Amsterdam': 'Netherlands', 'London': 'United Kingdom', 'Paris': 'France',
            'Tokyo': 'Japan', 'Seoul': 'South Korea', 'Singapore': 'Singapore',
            'Dubai': 'United Arab Emirates', 'New York': 'United States',
            'Los Angeles': 'United States', 'Chicago': 'United States',
            'Toronto': 'Canada', 'Vancouver': 'Canada', 'Montreal': 'Canada',
            'Sydney': 'Australia', 'Melbourne': 'Australia', 'Auckland': 'New Zealand'
        };
        return countryMap[cityName] || 'Unknown';
    }
    
    getCountryCode(cityName) {
        const codeMap = {
            'Bangkok': 'TH', 'Lisbon': 'PT', 'Mexico City': 'MX',
            'Bali': 'ID', 'Barcelona': 'ES', 'Ho Chi Minh City': 'VN',
            'Prague': 'CZ', 'Medellín': 'CO', 'Berlin': 'DE',
            'Amsterdam': 'NL', 'London': 'GB', 'Paris': 'FR',
            'Tokyo': 'JP', 'Seoul': 'KR', 'Singapore': 'SG',
            'Dubai': 'AE', 'New York': 'US', 'Los Angeles': 'US',
            'Chicago': 'US', 'Toronto': 'CA', 'Vancouver': 'CA',
            'Montreal': 'CA', 'Sydney': 'AU', 'Melbourne': 'AU',
            'Auckland': 'NZ'
        };
        return codeMap[cityName] || 'XX';
    }
    
    getCurrency(cityName) {
        const currencyMap = {
            'Bangkok': 'THB', 'Lisbon': 'EUR', 'Mexico City': 'MXN',
            'Bali': 'IDR', 'Barcelona': 'EUR', 'Ho Chi Minh City': 'VND',
            'Prague': 'CZK', 'Medellín': 'COP', 'Berlin': 'EUR',
            'Amsterdam': 'EUR', 'London': 'GBP', 'Paris': 'EUR',
            'Tokyo': 'JPY', 'Seoul': 'KRW', 'Singapore': 'SGD',
            'Dubai': 'AED', 'New York': 'USD', 'Los Angeles': 'USD',
            'Chicago': 'USD', 'Toronto': 'CAD', 'Vancouver': 'CAD',
            'Montreal': 'CAD', 'Sydney': 'AUD', 'Melbourne': 'AUD',
            'Auckland': 'NZD', 'Mumbai': 'INR', 'Delhi': 'INR',
            'Bangalore': 'INR', 'Cairo': 'EGP', 'Lagos': 'NGN',
            'Nairobi': 'KES', 'Johannesburg': 'ZAR', 'Cape Town': 'ZAR'
        };
        return currencyMap[cityName] || 'USD';
    }
    
    getExchangeRate(cityName) {
        const rateMap = {
            'Bangkok': 36.5, 'Lisbon': 0.92, 'Mexico City': 17.1,
            'Bali': 15650, 'Barcelona': 0.92, 'Ho Chi Minh City': 24500,
            'Prague': 23.2, 'Medellín': 3950, 'Berlin': 0.92,
            'Amsterdam': 0.92, 'London': 0.79, 'Paris': 0.92,
            'Tokyo': 149.5, 'Seoul': 1315, 'Singapore': 1.35,
            'Dubai': 3.67, 'New York': 1.0, 'Los Angeles': 1.0,
            'Chicago': 1.0, 'Toronto': 1.36, 'Vancouver': 1.36,
            'Montreal': 1.36, 'Sydney': 1.52, 'Melbourne': 1.52,
            'Auckland': 1.61, 'Mumbai': 83.2, 'Delhi': 83.2,
            'Bangalore': 83.2, 'Cairo': 30.9, 'Lagos': 777.5,
            'Nairobi': 147.5, 'Johannesburg': 18.7, 'Cape Town': 18.7
        };
        return rateMap[cityName] || 1.0;
    }
    
    getInternetSpeed(cityName) {
        const highSpeedCities = ['Singapore', 'Seoul', 'Tokyo', 'Amsterdam', 'Berlin', 'New York'];
        const mediumSpeedCities = ['Lisbon', 'Barcelona', 'Paris', 'London', 'Toronto', 'Sydney'];
        
        if (highSpeedCities.includes(cityName)) return 'Very Fast';
        if (mediumSpeedCities.includes(cityName)) return 'Fast';
        return 'Moderate';
    }
    
    getCityDescription(cityName) {
        const descriptions = {
            'Bangkok': 'Vibrant street life and ornate shrines with amazing food scene',
            'Lisbon': 'Coastal capital with pastel buildings and historic charm',
            'Mexico City': 'High-altitude capital rich in culture and cuisine',
            'Bali': 'Tropical paradise known for beaches and spiritual retreats',
            'Barcelona': 'Mediterranean city famous for art and architecture',
            'Ho Chi Minh City': 'Dynamic Vietnamese metropolis with French colonial influences',
            'Prague': 'Fairytale city with Gothic architecture and beer culture',
            'Medellín': 'Innovative city known as the "City of Eternal Spring"',
            'Berlin': 'Creative capital with vibrant nightlife and history',
            'Amsterdam': 'Canal-lined city with artistic heritage and liberal culture',
            'London': 'Global financial hub with royal history and diversity',
            'Paris': 'Romantic capital known for art, fashion, and cuisine',
            'Tokyo': 'Modern metropolis blending tradition with cutting-edge technology',
            'Seoul': 'Dynamic Korean capital with K-pop and tech innovation',
            'Singapore': 'Garden city with multicultural cuisine and modern architecture',
            'Dubai': 'Futuristic oasis with luxury shopping and stunning architecture',
            'New York': 'The city that never sleeps with endless opportunities',
            'Los Angeles': 'Entertainment capital with beautiful beaches and sunshine',
            'Chicago': 'Windy City with stunning architecture and deep-dish pizza',
            'Toronto': 'Multicultural hub with CN Tower and diverse neighborhoods',
            'Vancouver': 'Coastal city surrounded by mountains and ocean',
            'Montreal': 'French-Canadian city with European charm',
            'Sydney': 'Harbor city with iconic Opera House and beaches',
            'Melbourne': 'Cultural capital with coffee culture and street art',
            'Auckland': 'City of sails with stunning harbors and volcanoes',
            'Mumbai': 'Bollywood capital and financial hub of India',
            'Delhi': 'Historic capital with ancient monuments and modern buzz',
            'Bangalore': 'Silicon Valley of India with tech hub and pleasant weather',
            'Cairo': 'Ancient city home to pyramids and rich history',
            'Lagos': 'Vibrant African megacity with entrepreneurial spirit',
            'Nairobi': 'Gateway to East African safaris and growing tech scene',
            'Johannesburg': 'South African economic hub with cultural diversity',
            'Cape Town': 'Stunning coastal city with Table Mountain and wine regions'
        };
        
        return descriptions[cityName] || 'Amazing destination for digital nomads';
    }
    
    loadFallbackData() {
       
        this.cities = [
            {
                name: 'Bangkok',
                country: 'Thailand',
                countryCode: 'TH',
                lat: 13.7563,
                lng: 100.5018,
                monthlyCost: 800,
                currency: 'THB',
                exchangeRate: 36.5,
                qualityOfLife: 7.2,
                internetSpeed: 'Fast',
                description: 'Vibrant city with amazing food and low cost of living'
            },
            {
                name: 'Lisbon',
                country: 'Portugal',
                countryCode: 'PT',
                lat: 38.7223,
                lng: -9.1393,
                monthlyCost: 1500,
                currency: 'EUR',
                exchangeRate: 0.92,
                qualityOfLife: 8.1,
                internetSpeed: 'Very Fast',
                description: 'Beautiful coastal city with great weather and culture'
            },
            {
                name: 'Mexico City',
                country: 'Mexico',
                countryCode: 'MX',
                lat: 19.4326,
                lng: -99.1332,
                monthlyCost: 1000,
                currency: 'MXN',
                exchangeRate: 17.1,
                qualityOfLife: 7.5,
                internetSpeed: 'Fast',
                description: 'Huge cultural hub with affordable living'
            },
            {
                name: 'Bali',
                country: 'Indonesia',
                countryCode: 'ID',
                lat: -8.3405,
                lng: 115.0920,
                monthlyCost: 900,
                currency: 'IDR',
                exchangeRate: 15650,
                qualityOfLife: 7.8,
                internetSpeed: 'Moderate',
                description: 'Tropical paradise with digital nomad community'
            },
            {
                name: 'Barcelona',
                country: 'Spain',
                countryCode: 'ES',
                lat: 41.3851,
                lng: 2.1734,
                monthlyCost: 1800,
                currency: 'EUR',
                exchangeRate: 0.92,
                qualityOfLife: 8.3,
                internetSpeed: 'Very Fast',
                description: 'Amazing city with beaches, architecture, and culture'
            },
            {
                name: 'Ho Chi Minh City',
                country: 'Vietnam',
                countryCode: 'VN',
                lat: 10.8231,
                lng: 106.6297,
                monthlyCost: 700,
                currency: 'VND',
                exchangeRate: 24500,
                qualityOfLife: 6.9,
                internetSpeed: 'Fast',
                description: 'Dynamic city with incredible street food'
            },
            {
                name: 'Prague',
                country: 'Czech Republic',
                countryCode: 'CZ',
                lat: 50.0755,
                lng: 14.4378,
                monthlyCost: 1400,
                currency: 'CZK',
                exchangeRate: 23.2,
                qualityOfLife: 8.0,
                internetSpeed: 'Very Fast',
                description: 'Beautiful historic city with affordable living'
            },
            {
                name: 'Medellín',
                country: 'Colombia',
                countryCode: 'CO',
                lat: 6.2442,
                lng: -75.5712,
                monthlyCost: 800,
                currency: 'COP',
                exchangeRate: 3950,
                qualityOfLife: 7.3,
                internetSpeed: 'Fast',
                description: 'City of eternal spring with great weather'
            }
        ];
    }

    filterAndDisplayCities() {
        const affordableCities = this.allCities.filter(city => city.monthlyCost <= this.monthlyBudget);
        
        if (affordableCities.length === 0) {
            this.showError(`No cities found within your $${this.monthlyBudget} monthly budget. Consider increasing your budget.`);
            return;
        }

        affordableCities.sort((a, b) => b.qualityOfLife - a.qualityOfLife);
        this.cities = affordableCities;
        this.displayCities(this.cities);
        this.showResults();
    }

    displayCities(cities) {
        const grid = document.getElementById('citiesGrid');
        grid.innerHTML = '';

        cities.forEach(city => {
            const card = this.createCityCard(city);
            grid.appendChild(card);
        });
    }

    createCityCard(city) {
        const card = document.createElement('div');
        card.className = 'city-card rounded-xl shadow-lg overflow-hidden';
        
        const budgetRemaining = this.monthlyBudget - city.monthlyCost;
        const budgetPercentage = (city.monthlyCost / this.monthlyBudget) * 100;
        
        let qualityClass = 'quality-average';
        if (city.qualityOfLife >= 8) qualityClass = 'quality-excellent';
        else if (city.qualityOfLife >= 7) qualityClass = 'quality-good';
        
        let budgetBarClass = 'budget-bar';
        if (budgetPercentage > 80) budgetBarClass = 'budget-bar danger';
        else if (budgetPercentage > 60) budgetBarClass = 'budget-bar warning';
        
        let internetIcon = 'fa-wifi';
        let internetColor = 'text-gray-500';
        if (city.internetSpeed === 'Very Fast') {
            internetIcon = 'fa-rocket';
            internetColor = 'text-green-600';
        } else if (city.internetSpeed === 'Fast') {
            internetIcon = 'fa-wifi';
            internetColor = 'text-blue-600';
        }
        
        card.innerHTML = `
            <div class="relative">
                <div class="h-1 ${qualityClass}"></div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800 mb-1">${city.name}</h3>
                            <p class="text-gray-600 text-sm">${city.country}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold gradient-text">$${city.monthlyCost}</div>
                            <div class="text-xs text-gray-500">/month</div>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <div class="flex justify-between text-xs mb-1">
                            <span class="font-semibold text-gray-700">Budget Usage</span>
                            <span class="font-bold ${budgetPercentage > 80 ? 'text-red-600' : 'text-green-600'}">${budgetPercentage.toFixed(1)}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div class="${budgetBarClass} h-2 rounded-full transition-all duration-500" style="width: ${budgetPercentage}%"></div>
                        </div>
                        <div class="text-xs mt-1 font-semibold ${budgetRemaining > 0 ? 'text-green-600' : 'text-red-600'}">
                            ${budgetRemaining > 0 ? '✓' : '⚠'} $${Math.abs(budgetRemaining)} ${budgetRemaining > 0 ? 'remaining' : 'over budget'}
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div class="bg-gray-50 p-2 rounded-lg">
                            <div class="flex items-center mb-1">
                                <i class="fas fa-coins mr-1 text-yellow-500 text-xs"></i>
                                <span class="text-xs font-semibold text-gray-700">Currency</span>
                            </div>
                            <div class="text-xs font-bold text-gray-800">${city.currency}</div>
                            <div class="text-xs text-gray-600">${city.exchangeRate} to USD</div>
                        </div>
                        
                        <div class="bg-gray-50 p-2 rounded-lg">
                            <div class="flex items-center mb-1">
                                <i class="fas fa-star mr-1 text-yellow-500 text-xs"></i>
                                <span class="text-xs font-semibold text-gray-700">Quality</span>
                            </div>
                            <div class="text-sm font-bold text-gray-800">${city.qualityOfLife}/10</div>
                            <div class="w-full bg-gray-200 rounded-full h-1 mt-1">
                                <div class="${qualityClass} h-1 rounded-full" style="width: ${city.qualityOfLife * 10}%"></div>
                            </div>
                        </div>
                        
                        <div class="bg-gray-50 p-2 rounded-lg">
                            <div class="flex items-center mb-1">
                                <i class="fas ${internetIcon} mr-1 ${internetColor} text-xs"></i>
                                <span class="text-xs font-semibold text-gray-700">Internet</span>
                            </div>
                            <div class="text-xs font-bold text-gray-800">${city.internetSpeed}</div>
                        </div>
                        
                        <div class="bg-gray-50 p-2 rounded-lg">
                            <div class="flex items-center mb-1">
                                <i class="fas fa-map-marker-alt mr-1 text-red-500 text-xs"></i>
                                <span class="text-xs font-semibold text-gray-700">Location</span>
                            </div>
                            <div class="text-xs font-bold text-gray-800">${city.lat.toFixed(1)}°, ${city.lng.toFixed(1)}°</div>
                        </div>
                    </div>
                    
                    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p class="text-gray-700 text-xs leading-relaxed">${city.description}</p>
                    </div>
                    
                    <button onclick="planner.viewCityOnMap(${city.lat}, ${city.lng})" 
                            class="w-full btn-primary text-white py-2 rounded-lg font-semibold hover:shadow-md transition-all">
                        <i class="fas fa-map-marked-alt mr-2"></i>
                        View on Map
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }

    initMap() {
        const mapDiv = document.getElementById('map');
        const affordableCities = this.cities;
        
        mapDiv.innerHTML = `
            <div class="bg-gray-50 h-full rounded-xl p-6">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-bold text-gray-800">
                        <i class="fas fa-globe-americas mr-2 text-gray-600"></i>
                        World Destinations
                    </h4>
                    <span class="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
                        ${affordableCities.length} cities found
                    </span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-2">
                    ${affordableCities.map(city => `
                        <div class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-all cursor-pointer border border-gray-200 hover:border-gray-300" 
                             onclick="planner.viewCityOnMap(${city.lat}, ${city.lng})">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h5 class="font-bold text-gray-800 text-sm">${city.name}</h5>
                                    <p class="text-xs text-gray-600">${city.country}</p>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm font-bold text-gray-800">$${city.monthlyCost}</div>
                                    <div class="text-xs text-gray-500">/month</div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between text-xs">
                                <span class="flex items-center">
                                    <i class="fas fa-star mr-1 text-yellow-500"></i>
                                    ${city.qualityOfLife}/10
                                </span>
                                <span class="flex items-center">
                                    <i class="fas fa-wifi mr-1 ${city.internetSpeed === 'Very Fast' ? 'text-green-600' : 'text-gray-500'}"></i>
                                    ${city.internetSpeed}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 text-center">
                    <p class="text-sm text-gray-600">
                        <i class="fas fa-info-circle mr-1"></i>
                        Click on any city card to view detailed location information
                    </p>
                </div>
            </div>
        `;
    }

    viewCityOnMap(lat, lng) {
        const mapDiv = document.getElementById('map');
        const city = this.cities.find(c => Math.abs(c.lat - lat) < 0.01 && Math.abs(c.lng - lng) < 0.01);
        
        mapDiv.innerHTML = `
            <div class="bg-gray-50 h-full rounded-xl p-6">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-bold text-gray-800">
                        <i class="fas fa-map-pin mr-2 text-red-500"></i>
                        ${city ? city.name : 'Location Selected'}
                    </h4>
                    <button onclick="planner.initMap()" 
                            class="text-gray-600 hover:text-gray-800 transition-colors">
                        <i class="fas fa-arrow-left mr-1"></i>
                        Back to All Cities
                    </button>
                </div>
                
                <div class="bg-white rounded-lg p-6 shadow-lg">
                    <div class="text-center mb-6">
                        <i class="fas fa-map-marker-alt text-6xl text-red-500 animate-pulse"></i>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h5 class="font-bold text-gray-800 mb-3">Location Details</h5>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">City:</span>
                                    <span class="font-semibold">${city ? city.name : 'Unknown'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Country:</span>
                                    <span class="font-semibold">${city ? city.country : 'Unknown'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Coordinates:</span>
                                    <span class="font-mono text-sm">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span>
                                </div>
                            </div>
                        </div>
                        
                        ${city ? `
                            <div>
                                <h5 class="font-bold text-gray-800 mb-3">Living Information</h5>
                                <div class="space-y-2">
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">Monthly Cost:</span>
                                        <span class="font-semibold">$${city.monthlyCost}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">Quality Score:</span>
                                        <span class="font-semibold">${city.qualityOfLife}/10</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600">Internet:</span>
                                        <span class="font-semibold">${city.internetSpeed}</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${city ? `
                        <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                            <p class="text-gray-700 text-sm">${city.description}</p>
                        </div>
                    ` : ''}
                    
                    <div class="mt-6 text-center">
                        <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" 
                           class="inline-block btn-primary text-white px-6 py-2 rounded-lg font-semibold hover:shadow-md transition-all">
                            <i class="fas fa-external-link-alt mr-2"></i>
                            Open in Google Maps
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('errorSection').classList.add('hidden');
    }

    showResults() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('resultsSection').classList.remove('hidden');
        document.getElementById('errorSection').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('errorSection').classList.remove('hidden');
    }
}


const planner = new DigitalNomadPlanner();
