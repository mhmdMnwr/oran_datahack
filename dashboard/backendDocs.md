```typescript
class Hive {
	id: string; // Unique identifier, we will use Microcontroller MAC address as the ID
	queenStatus: "present" | "absent"; // The status of the queen bee in the hive
    name: string;
	location: {
		latitude: number;
		longitude: number;
	};
	createdAt: Date;
	updatedAt: Date;
}

class Alert {
	_id: ObjectId;
	hive: Hive;
	severity: "low" | "medium" | "high";
	type: string;
	message: string;
	resolved: boolean;
	createdAt: Date;
	updatedAt: Date;
}

class SensorData<T> {
	_id: ObjectId;
	hive: Hive;
	type: string;
	value: T;
	createdAt: Date;
	updatedAt: Date;
	expiresAfter: number; // auto delete document after this many seconds
}

class TemperatureData extends SensorData<number> {
	type: "temperature";
	expiresAfter = 60 * 60 * 24; // expire after 24 hours
}

class HumidityData extends SensorData<number> {
	type: "humidity";
	expiresAfter = 60 * 60 * 24; // expire after 24 hours
}

class WeightData extends SensorData<number> {
	type: "weight";
	expiresAfter = 60 * 25; // expire after 25 minutes
}

class PopulationData extends SensorData<number> {
	type: "population";
	expiresAfter = 60 * 25; // expire after 25 minutes
}

class WeightRecord {
	_id: ObjectId;
	hive: Hive;
	weight: number; // the weight of the hive at the time of recording
	recordedAt: Date; // the day the weight was recorded
}

class PopulationRecord {
	_id: ObjectId;
	hive: Hive;
	population: number; // the population of the hive at the time of recording
	recordedAt: Date; // the day the population was recorded
}
```

# API Endpoints (With example responses)

- GET `/hives` : return all hives with their latest sensor data

```json
[
	{
		"id": "00:1A:7D:DA:71:13",
		"name": "Hive 1",
		"queenStatus": "present",
		"location": {
			"latitude": 40.7128,
			"longitude": -74.006
		},
		"createdAt": "2024-06-01T12:00:00.000Z",
		"updatedAt": "2024-06-01T12:00:00.000Z",
		"latestSensorData": {
			"temperature": 35.5, // from TemperatureData
			"humidity": 60, // from HumidityData
			"weight": 10.5, // from WeightRecord
			"population": 5000 // from PopulationRecord
		},
		"hasAlerts": true // true if there are any unresolved alerts for this hive, false otherwise
	}
	//   ....
]
```

- GET `/hives/:id` : return a specific hive

```json
{
	"id": "00:1A:7D:DA:71:13",
	"name": "Hive 1",
	"queenStatus": "present",
	"location": {
		"latitude": 40.7128,
		"longitude": -74.006
	},
	"createdAt": "2024-06-01T12:00:00.000Z",
	"updatedAt": "2024-06-01T12:00:00.000Z",
	"sensorsData": {
		"temperature": [
			{
				"value": 35.5, // The Avg of each hour for the last 24 hours
				"hour": "22:00" // The hour of the day for this data point
			}
			//  ....
		],
		"humidity": [
			{
				"value": 60, // The Avg of each hour for the last 24 hours
				"hour": "22:00" // The hour of the day for this data point
			}
			//  ....
		],
		"weight": [
			{
				"value": 10.5, // The max weight for each day for the last 12 days
				"date": "2024-05-01" // The date for this data point
			}
			//  ....
		],
		"population": [
			{
				"value": 5000, // The max population for each day for the last 12 days
				"date": "2024-05-01" // The date for this data point
			}
			//  ....
		]
	},
	"alerts": [
		{
			"_id": "64a9c8e5f1b2c8b1a2d3e4f6",
			"severity": "high",
			"type": "temperature",
			"message": "Hive temperature is too high!",
			"resolved": false,
			"createdAt": "2024-06-01T12:00:00.000Z",
			"updatedAt": "2024-06-01T12:00:00.000Z"
		}
		//  ....
	]
}
```

> [!NOTE] for weight and population data, get the data from the `weightRecords` and `populationRecords` collections instead of the `sensorData` collection.

- POST `/alerts/:alertID/resolve` : mark an alert as resolved (delete the alert from the database)

```json
{
	"_id": "64a9c8e5f1b2c8b1a2d3e4f6",
	"severity": "high",
	"type": "temperature",
	"message": "Hive temperature is too high!",
	"resolved": true,
	"createdAt": "2024-06-01T12:00:00.000Z",
	"updatedAt": "2024-06-01T12:00:00.000Z"
}
```

# Data From MOSQUITTO (Topic with message format)

Run a MQTT client that listens to the following topics dynamically for each hive (use the `hiveMAC` as a parameter in the topic) after get them from the `hives` collection in the database:

- `/<sensorType>Data/:hiveMAC` : save the sensor data for a specific hive

```json
{
	"value": 35.5
}
```

Save the data in the `sensorData` collection with: - `hiveId` : the ID of the hive that the data belongs to (get it by the `hiveMAC` in the topic) - `type` : the type of the sensor data (temperature, humidity, weight, population) - `value` : the value of the sensor data - `expiresAfter` : the time in seconds after which the document should be automatically deleted (24 hours for temperature and humidity data, 25 minutes for weight and population data)

> If the `sensorType` is `weight` or `population`, after save the data : update the max vaalue in `weightRecords` or `populationRecords` collection with the new value if the new value is greater than the current max value for today (use `recordedAt` field to check if the record is for today or not, if not create a new record for today with the new value).

- `newHive` : create a new hive with the given data

```json
{
	"name": "New Hive",
	"microcontrollerMAC": "00:1A:7D:DA:71:13"
}
```

Save the data in the `hives` collection with: - `name` : the name of the hive - `location` : the location of the hive (latitude and longitude) - `microcontrollerMAC` : the unique identifier for the hive's microcontroller (used to link the hive with the sensor data coming from MOSQUITTO)

- `locationUpdate/:hiveMAC` : update the location of a specific hive

```json
{
	"latitude": 40.7128,
	"longitude": -74.006
}
```

Update the `location` field of the hive with the given `hiveMAC` in the `hives` collection with the new location data.
Create an alert:
```json
{
    "hive": "00:1A:7D:DA:71:13", // the ID of the hive that the alert belongs to
    "severity": "medium",
    "type": "locationUpdate",
    "message": "Hive location has been updated.",
    "resolved": false,
    "createdAt": "2024-06-01T12:00:00.000Z",
    "updatedAt": "2024-06-01T12:00:00.000Z"
}
```

- `audioSensorData/:hiveMAC` : Get the audio sensor data (1d array of raw audio data) for a specific hive,

```json
{
  "value": [0.1, 0.2, 0.3, ...] // 1d array of raw audio data
}
```

then convert it to spectogram data (2d array) and save in local variable (not in the database) for 1 minute.
Each 1 minute, use AI models (localy) to analyze the spectogram data and get result :

```json
{
  "queenStatus": "present" | "absent",
  "swarmProbability": 0.8, // a value between 0 and 1 indicating the probability of swarm
  "requeeningAcceptance": true, // true if the hive is accepting a new queen, false otherwise
  "population": 5000, // the population of the hive based on the audio data
  "varroaVirusProbability": 0.2, // a value between 0 and 1 indicating the probability of varroa virus infestation
}
```

Update the `queenStatus` field of the hive in the `hives`.
Update the `population` field in the `populationRecords` collection if the new population value is greater than the current max value for today. (create a new record for today if there is no record for today)
If the `swarmProbability` is greater than 0.7, create a new alert : 
```json
{
    "hive": "00:1A:7D:DA:71:13", // the ID of the hive that the alert belongs to
    "severity": "high",
    "type": "swarm",
    "message": "Hive is likely to swarm!",
    "resolved": false,
    "createdAt": "2024-06-01T12:00:00.000Z",
    "updatedAt": "2024-06-01T12:00:00.000Z"
}
```

If the `varroaVirusProbability` is greater than 0.7, create a new alert : 
```json
{
    "hive": "00:1A:7D:DA:71:13", // the ID of the hive that the alert belongs to
    "severity": "high",
    "type": "varroaVirus",
    "message": "Hive is likely infested with varroa virus!",
    "resolved": false,
    "createdAt": "2024-06-01T12:00:00.000Z",
    "updatedAt": "2024-06-01T12:00:00.000Z"
}
```


