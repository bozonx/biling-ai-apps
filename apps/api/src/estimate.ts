import { Body, Controller, Post, BadRequestException } from "@nestjs/common";
import { estimateRequestSchema } from "@billing/contracts";
import { estimateCredits } from "@billing/core";

@Controller("billing")
export class EstimateController {
  @Post("estimate")
  estimate(@Body() body: unknown) {
    const result = estimateRequestSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException({ code: "INVALID_ESTIMATE" });
    return {
      creditsMilli: estimateCredits(
        BigInt(result.data.costNanoUsd),
        BigInt(result.data.creditPriceUsdMicros),
      ).toString(),
    };
  }
}
