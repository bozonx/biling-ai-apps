import { EstimateController } from "./estimate.js";
import { Controller, Get, Module } from "@nestjs/common";
@Controller("health")
export class HealthController {
  @Get() health() {
    return { status: "ok", service: "api" };
  }
}
@Module({ controllers: [HealthController, EstimateController] })
export class AppModule {}
