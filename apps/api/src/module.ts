import { StaffAccess } from "./staff.js";
import { AdminController } from "./admin-controller.js";
import { DevAccountController } from "./dev-account.js";
import { Database } from "./database.js";
import { WalletService } from "./wallet.js";
import { BillingController } from "./billing-controller.js";
import { EstimateController } from "./estimate.js";
import { Controller, Get, Module } from "@nestjs/common";
@Controller("health")
export class HealthController {
  @Get() health() {
    return { status: "ok", service: "api" };
  }
}
@Module({
  providers: [Database, WalletService, StaffAccess],
  controllers: [
    AdminController,
    HealthController,
    EstimateController,
    BillingController,
    DevAccountController,
  ],
})
export class AppModule {}
