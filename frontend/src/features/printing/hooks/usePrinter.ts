"use client";

import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import type { TicketData } from "@/features/pos/types/pos.types";
import { BluetoothPrinterService } from "../services/bluetooth-printer.service";
import { getPrinterConfig } from "../services/printer-config.service";
import { buildTicketBytes } from "../services/ticket-builder.service";
import type { PrinterStatus } from "../types/printing.types";

export function usePrinter() {
  const [status, setStatus] = useState<PrinterStatus>("disconnected");
  const [deviceName, setDeviceName] = useState("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!BluetoothPrinterService.isSupported()) setStatus("unsupported");
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const name = await BluetoothPrinterService.connect(() => {
        setStatus("disconnected");
        setDeviceName("");
        message.warning("Impresora desconectada");
      });
      setDeviceName(name);
      setStatus("connected");
      message.success(`Impresora conectada: ${name}`);
    } catch (err) {
      setStatus("disconnected");
      // NotFoundError = the user closed the device chooser without picking one
      if ((err as DOMException)?.name !== "NotFoundError") {
        message.error(
          err instanceof Error ? err.message : "No se pudo conectar la impresora"
        );
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    BluetoothPrinterService.disconnect();
    setStatus("disconnected");
    setDeviceName("");
  }, []);

  const print = useCallback(
    async (ticket: TicketData, branchName?: string | null): Promise<boolean> => {
      if (!BluetoothPrinterService.isConnected()) {
        message.warning("Conecta la impresora primero");
        return false;
      }
      setPrinting(true);
      try {
        const { paperWidth, businessName } = await getPrinterConfig();
        await BluetoothPrinterService.write(
          buildTicketBytes(ticket, { paperWidth, businessName, branchName })
        );
        return true;
      } catch (err) {
        message.error(err instanceof Error ? err.message : "Error al imprimir");
        return false;
      } finally {
        setPrinting(false);
      }
    },
    []
  );

  return { status, deviceName, printing, connect, disconnect, print };
}
