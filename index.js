import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { DateTime } from "luxon";
import { WebSocketServer } from "ws";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const timeZone = "UTC";

const port = 3000;
const app = express();

app.use(express.static(path.join(__dirname, "public")));

const loadBuses = async () => {
  const data = await readFile(path.join(__dirname, "buses.json"), "utf-8");

  return JSON.parse(data);
};

const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
  const now = DateTime.now().setZone(timeZone);

  const [hours, minutes] = firstDepartureTime.split(":").map(Number);

  let departure = DateTime.now()
    .set({ hours, minutes, seconds: 0, milliseconds: 0 })
    .setZone(timeZone);

  const endOfDay = DateTime.now()
    .set({ hours: 23, minutes: 59, seconds: 59 })
    .setZone(timeZone);

  if (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });
  }

  if (departure > endOfDay) {
    departure = departure
      .startOf("day")
      .plus({ days: 1 })
      .set({ hours, minutes });
  }

  while (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });

    if (departure > endOfDay) {
      departure = departure
        .startOf("day")
        .plus({ days: 1 })
        .set({ hours, minutes });
    }
  }

  return departure;
};

const sendUpdatedData = async () => {
  const buses = await loadBuses();

  const updatedBuses = buses.map((bus) => {
    const nextDeparture = getNextDeparture(
      bus.firstDepartureTime,
      bus.frequencyMinutes
    );

    return {
      ...bus,
      nextDeparture: {
        date: nextDeparture.toFormat("yyyy-MM-dd"),
        time: nextDeparture.toFormat("HH:mm:ss"),
      },
    };
  });

  return updatedBuses;
};

const sortBuses = (buses) => {
  return [...buses].sort(
    (a, b) =>
      +new Date(`${a.nextDeparture.date}T${a.nextDeparture.time}Z`) -
      +new Date(`${b.nextDeparture.date}T${b.nextDeparture.time}Z`)
  );
};

app.get("/next-departure", async (req, res) => {
  try {
    const updatedBuses = await sendUpdatedData();

    const sortedBuses = sortBuses(updatedBuses);

    res.json(sortedBuses);
  } catch (error) {
    res.send("error");
  }
});

const wss = new WebSocketServer({ noServer: true });

const clients = new Set();

wss.on("connection", (ws) => {
  console.log("WebSocet connection");

  clients.add(ws);

  const sendUpdates = async () => {
    try {
      const updatedBuses = await sendUpdatedData();
      const sortedBuses = sortBuses(updatedBuses);

      ws.send(JSON.stringify(sortBuses));
    } catch (error) {
      console.error(`Error websocket connection: ${error}`);
    }
  };

  const itervalId = setInterval(sendUpdates, 1000);

  ws.on("close", () => {
    clearInterval(itervalId);
    clients.delete(ws);
    console.log("WebSocet closed");
  });
});

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
