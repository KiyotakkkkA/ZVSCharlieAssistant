import type {
  ScenarioDeliveryChannel,
  ScenarioDeliveryJob,
} from "../../database/scenario-delivery.repository";

export interface ScenarioDeliveryAdapter {
  readonly channel: ScenarioDeliveryChannel;
  deliver(job: ScenarioDeliveryJob): Promise<void>;
}

export class ScenarioDeliveryAdapterRegistry {
  private readonly adapters: Map<
    ScenarioDeliveryChannel,
    ScenarioDeliveryAdapter
  >;
  constructor(adapters: ScenarioDeliveryAdapter[]) {
    this.adapters = new Map(
      adapters.map((adapter) => [adapter.channel, adapter]),
    );
  }
  resolve(channel: ScenarioDeliveryChannel) {
    const adapter = this.adapters.get(channel);
    if (!adapter)
      throw new Error(`Не зарегистрирован канал доставки ${channel}`);
    return adapter;
  }
}
