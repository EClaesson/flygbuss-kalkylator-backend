import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();

const DAYS_AHEAD = 9;

interface Flight {
  id: string;
  destination: string;
  departure: string;
}

export const fetchFlights = functions.pubsub
    .schedule("5 0 * * *")
    .timeZone("Europe/Stockholm")
    .onRun(async () => {
      const date = new Date();

      const data: { [key: string]: { [key: string]: Flight[] } } = {};

      for (let i = 0; i < DAYS_AHEAD; i++) {
        const dateStr = date.toISOString().split("T")[0];
        const res = await axios.get(
            `https://www.swedavia.se/services/publicflightsboard/v2/departures/sv/RNB/${dateStr}`
        ).catch(() => {
          console.log("Failed get:", i, date);
        });

        if (!res?.data) {
          continue;
        }

        data[dateStr] = {};

        for (const flight of res.data.flights) {
          const airline = flight.airlineOperator.icao.replace("BRX", "FlygBRA");

          if (!Object.keys(data[dateStr]).includes(airline)) {
            data[dateStr][airline] = [];
          }

          data[dateStr][airline].push({
            id: flight.flightId,
            destination: flight.arrivalAirportSwedish,
            departure: flight.departureTime.scheduledUtc,
          });
        }

        date.setDate(date.getDate() + 1);
      }

      await admin.database().ref("/flights").set(data);
    });
