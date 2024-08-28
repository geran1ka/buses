const fetchBusData = async () => {
  try {
    const response = await fetch("/next-departure");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Error fetching bus data: ${error}`);
  }
};

const formatDate = (date) => date.toISOString().split("T")[0];
const formatTime = (date) => date.toTimeString().split(" ")[0].slice(0, 8);

const getTimeRemainingSeconds = (time) => {
  const now = new Date();

  const timeDefference = time - now;

  return Math.floor(timeDefference / 1000);
};

const renderBusData = (buses) => {
  const tableBody = document.querySelector("#bus tbody");

  tableBody.textContent = "";

  buses.forEach((bus) => {
    const row = document.createElement("tr");

    const nextDepartureDateTimeUTC = new Date(
      `${bus.nextDeparture.date}T${bus.nextDeparture.time}Z`
    );

    const remainingSeconds = getTimeRemainingSeconds(nextDepartureDateTimeUTC);

    const remainitTimeText =
      remainingSeconds < 60 ? `Отправляется` : bus.nextDeparture.remaining;

    row.innerHTML = `
      <td>${bus.busNumber}</td>
      <td>${bus.startPoint} - ${bus.endPoint}</td>
      <td>${formatDate(nextDepartureDateTimeUTC)}</td>
      <td>${formatTime(nextDepartureDateTimeUTC)}</td>
      <td>${remainitTimeText}</td>

    `;

    tableBody.append(row);
  });
};

const initWebSocket = () => {
  const ws = new WebSocket(`wss://${location.host}`);

  ws.addEventListener("open", () => {
    console.log("Websocket connection");
  });

  ws.addEventListener("message", (event) => {
    const buses = JSON.parse(event.data);
    renderBusData(buses);
  });

  ws.addEventListener("error", (error) => {
    console.log(`WebSocket error: ${error}`);
  });

  ws.addEventListener("close", () => {
    console.log(`WebSocket econnection close`);
  });
};

const updateTime = () => {
  const currentTimeElement = document.querySelector("#current-time");
  const now = new Date();
  currentTimeElement.textContent = now.toTimeString().split(" ")[0];

  setTimeout(() => {
    updateTime();
  }, 1000);
};

const init = async () => {
  const buses = await fetchBusData();

  renderBusData(buses);

  initWebSocket();

  updateTime();
};

init();
