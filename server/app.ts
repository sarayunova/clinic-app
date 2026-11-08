import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type { DB } from './db.js';
import type { Config } from './config.js';
import { LoginThrottle, resolveSession, type SessionUser } from './auth.js';
import { HttpError, forbidden, unauthorized } from './errors.js';
import { can, type Permission } from './permissions.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerPatientRoutes } from './routes/patients.js';
import { registerAppointmentRoutes } from './routes/appointments.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerVisitRoutes } from './routes/visits.js';
import { registerIpdRoutes } from './routes/ipd.js';
import { registerMedicineRoutes } from './routes/medicines.js';
import { registerDischargeRoutes } from './routes/discharge.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerPrintLogRoutes } from './routes/printlog.js';
import { registerExportRoutes } from './routes/export.js';
import { registerAttachmentRoutes } from './routes/attachments.js';
import { registerStationRoutes } from './routes/station.js';
import { registerPricingRoutes } from './routes/pricing.js';
import { registerChecklistRoutes } from './routes/checklist.js';
import { registerBackupRoutes } from './routes/backups.js';
import { registerSecurityRoutes } from './routes/security.js';
import { registerTemplateRoutes } from './routes/templates.js';
import { registerTvRoutes } from './routes/tv.js';
import { registerAntenatalChecklistRoutes } from './routes/antenatalChecklist.js';
import { registerPediatricRoutes } from './routes/pediatric.js';
import { registerClinicalSummaryRoutes } from './routes/clinicalSummary.js';
import { registerCommunicationRoutes } from './routes/communication.js';
import { registerUltrasoundRoutes } from './routes/ultrasounds.js';
import { registerLabRoutes } from './routes/lab.js';
import { registerPartographRoutes } from './routes/partograph.js';
import { registerOperativeNoteRoutes } from './routes/operativeNotes.js';
import { registerRiskAssessmentRoutes } from './routes/riskAssessments.js';
import { registerObstetricDischargeRoutes } from './routes/obstetricDischarges.js';
import { registerMaternityAdmissionRoutes } from './routes/maternityAdmissions.js';
import { registerAntenatalLabTrendsRoutes } from './routes/antenatalLabTrends.js';
import { registerMedicationSafetyRoutes } from './routes/medicationSafety.js';
import { registerPphResuscitationRoutes } from './routes/pphResuscitation.js';
import { registerNeonatalResuscitationRoutes } from './routes/neonatalResuscitation.js';
import { registerMaternalMeowsRoutes } from './routes/maternalMeows.js';
import { registerNeonatalJaundiceRoutes } from './routes/neonatalJaundice.js';
import { registerInfertilityFolliculometryRoutes } from './routes/infertilityFolliculometry.js';
import { registerErasReedaRoutes } from './routes/erasReeda.js';
import { registerGestationalDiabetesRoutes } from './routes/gestationalDiabetes.js';
import { registerCardiotocographyRoutes } from './routes/cardiotocography.js';
import { registerPediatricGrowthRoutes } from './routes/pediatricGrowth.js';
import { registerCervicalScreeningRoutes } from './routes/cervicalScreening.js';
import { registerContraceptionRoutes } from './routes/contraception.js';
import { registerPndtRoutes } from './routes/pndt.js';
import { registerGeneticScreeningRoutes } from './routes/geneticScreening.js';
import { registerFetalDopplerRoutes } from './routes/fetalDoppler.js';
import { registerPreeclampsiaScreeningRoutes } from './routes/preeclampsiaScreening.js';
import { registerMultipleGestationRoutes } from './routes/multipleGestation.js';
import { registerInductionRoutes } from './routes/induction.js';
import { registerPerinatalLossRoutes } from './routes/perinatalLoss.js';
import { registerArtCycleRoutes } from './routes/artCycles.js';
import { registerEndometriosisRoutes } from './routes/endometriosis.js';
import { registerUrogynecologyRoutes } from './routes/urogynecology.js';
import { registerGynOncologyRoutes } from './routes/gynOncology.js';
import { registerSncuRoutes } from './routes/sncu.js';
import { registerCommunicationRecallRoutes } from './routes/communicationRecall.js';
import { registerWardBoardRoutes } from './routes/wardBoard.js';
import { registerTeleconsultationRoutes } from './routes/teleconsultations.js';
import { registerAbdmRoutes } from './routes/abdm.js';
import { registerOtSchedulerRoutes } from './routes/otScheduler.js';
import { registerBloodBankRoutes } from './routes/bloodBank.js';
import { registerPediatricRenalRoutes } from './routes/pediatricRenal.js';
import { registerAmsRoutes } from './routes/ams.js';
import { registerObstetricHduRoutes } from './routes/obstetricHdu.js';
import { registerPalsPewsRoutes } from './routes/palsPews.js';
import { registerNicuTpnRoutes } from './routes/nicuTpn.js';
import { registerMaternalComorbiditiesRoutes } from './routes/maternalComorbidities.js';
import { registerPediatricAllergyRoutes } from './routes/pediatricAllergy.js';
import { registerNeonatalHieRoutes } from './routes/neonatalHie.js';
import { registerMaternalSepsisRoutes } from './routes/maternalSepsis.js';
import { registerPediatricDkaRoutes } from './routes/pediatricDka.js';
import { registerNeonatalRdsRoutes } from './routes/neonatalRds.js';
import { registerMaternalVteRoutes } from './routes/maternalVte.js';
import { registerPediatricSeizuresRoutes } from './routes/pediatricSeizures.js';
import { registerNeonatalSepsisRoutes } from './routes/neonatalSepsis.js';
import { registerObstetricHypertensionRoutes } from './routes/obstetricHypertension.js';
import { registerPediatricSepticShockRoutes } from './routes/pediatricSepticShock.js';
import { registerNeonatalHypoglycemiaRoutes } from './routes/neonatalHypoglycemia.js';
import { registerObstetricPphRoutes } from './routes/obstetricPph.js';
import { registerPediatricPardsRoutes } from './routes/pediatricPards.js';
import { registerNeonatalBindAabrRoutes } from './routes/neonatalBindAabr.js';
import { registerObstetricIcpRoutes } from './routes/obstetricIcp.js';
import { registerPediatricStatusEpilepticusRoutes } from './routes/pediatricStatusEpilepticus.js';
import { registerNeonatalNecRoutes } from './routes/neonatalNec.js';
import { registerObstetricPasRoutes } from './routes/obstetricPas.js';
import { registerPediatricTbiPecarnRoutes } from './routes/pediatricTbiPecarn.js';
import { registerNeonatalPphnRoutes } from './routes/neonatalPphn.js';
import { registerObstetricAfeRoutes } from './routes/obstetricAfe.js';
import { registerPediatricAsthmaStatusRoutes } from './routes/pediatricAsthmaStatus.js';
import { registerNeonatalBpdRoutes } from './routes/neonatalBpd.js';
import { registerObstetricAflpRoutes } from './routes/obstetricAflp.js';
import { registerPediatricPolytraumaRoutes } from './routes/pediatricPolytrauma.js';
import { registerNeonatalHspdaRoutes } from './routes/neonatalHspda.js';
import { registerObstetricDkaRoutes } from './routes/obstetricDka.js';
import { registerPediatricAnaphylaxisRoutes } from './routes/pediatricAnaphylaxis.js';
import { registerNeonatalIvhRoutes } from './routes/neonatalIvh.js';
import { registerObstetricPpromRoutes } from './routes/obstetricPprom.js';
import { registerPediatricSvtRoutes } from './routes/pediatricSvt.js';
import { registerNeonatalHypocalcemiaRoutes } from './routes/neonatalHypocalcemia.js';
import { registerObstetricPosttermRoutes } from './routes/obstetricPostterm.js';
import { registerPediatricCroupRoutes } from './routes/pediatricCroup.js';
import { registerNeonatalPolycythemiaRoutes } from './routes/neonatalPolycythemia.js';
import { registerObstetricShoulderDystociaRoutes } from './routes/obstetricShoulderDystocia.js';
import { registerPediatricForeignBodyRoutes } from './routes/pediatricForeignBody.js';
import { registerNeonatalHypomagnesemiaRoutes } from './routes/neonatalHypomagnesemia.js';
import { registerObstetricPpcmRoutes } from './routes/obstetricPpcm.js';
import { registerPediatricSepticArthritisRoutes } from './routes/pediatricSepticArthritis.js';
import { registerNeonatalChylothoraxRoutes } from './routes/neonatalChylothorax.js';
import { registerObstetricCordProlapseRoutes } from './routes/obstetricCordProlapse.js';
import { registerPediatricIntussusceptionRoutes } from './routes/pediatricIntussusception.js';
import { registerNeonatalMasRoutes } from './routes/neonatalMas.js';
import { registerObstetricUterineInversionRoutes } from './routes/obstetricUterineInversion.js';
import { registerPediatricAppendicitisRoutes } from './routes/pediatricAppendicitis.js';
import { registerNeonatalTtnRoutes } from './routes/neonatalTtn.js';
import { registerObstetricPdphRoutes } from './routes/obstetricPdph.js';
import { registerPediatricBacterialMeningitisRoutes } from './routes/pediatricBacterialMeningitis.js';
import { registerNeonatalAopRoutes } from './routes/neonatalAop.js';
import { registerObstetricRetainedPlacentaRoutes } from './routes/obstetricRetainedPlacenta.js';
import { registerPediatricPyloricStenosisRoutes } from './routes/pediatricPyloricStenosis.js';
import { registerNeonatalSghRoutes } from './routes/neonatalSgh.js';
import { registerObstetricTolacRoutes } from './routes/obstetricTolac.js';
import { registerPediatricKawasakiRoutes } from './routes/pediatricKawasaki.js';
import { registerNeonatalVolvulusRoutes } from './routes/neonatalVolvulus.js';
import { registerObstetricEcvRoutes } from './routes/obstetricEcv.js';
import { registerPediatricDkaCerebralEdemaRoutes } from './routes/pediatricDkaCerebralEdema.js';
import { registerNeonatalMeconiumIleusRoutes } from './routes/neonatalMeconiumIleus.js';
import { registerObstetricPlacentalAbruptionRoutes } from './routes/obstetricPlacentalAbruption.js';
import { registerPediatricHusRoutes } from './routes/pediatricHus.js';
import { registerNeonatalEaTefRoutes } from './routes/neonatalEaTef.js';
import { registerObstetricVasaPreviaRoutes } from './routes/obstetricVasaPrevia.js';
import { registerPediatricEmpyemaRoutes } from './routes/pediatricEmpyema.js';
import { registerNeonatalAbdominalDefectsRoutes } from './routes/neonatalAbdominalDefects.js';
import { registerObstetricSptRoutes } from './routes/obstetricSpt.js';
import { registerPediatricOsteomyelitisRoutes } from './routes/pediatricOsteomyelitis.js';
import { registerNeonatalIntestinalAtresiaRoutes } from './routes/neonatalIntestinalAtresia.js';
import { registerObstetricHellpRoutes } from './routes/obstetricHellp.js';
import { registerPediatricScfeRoutes } from './routes/pediatricScfe.js';
import { registerNeonatalCdhRoutes } from './routes/neonatalCdh.js';
import { registerObstetricHyperemesisRoutes } from './routes/obstetricHyperemesis.js';
import { registerPediatricAcuteScrotumRoutes } from './routes/pediatricAcuteScrotum.js';
import { registerNeonatalSipRoutes } from './routes/neonatalSip.js';
import { registerObstetricPmcdRoutes } from './routes/obstetricPmcd.js';
import { registerPediatricGbsRoutes } from './routes/pediatricGbs.js';
import type { LoadedTls } from './tls.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionToken: string | undefined;
  }
}

export interface Ctx {
  db: DB;
  cfg: Config;
  throttle: LoginThrottle;
  /** Set true when served over HTTPS so the session cookie is marked Secure. */
  secureCookies: boolean;
  /** Folder holding the built web UI (dist/web). Omit for API-only (tests). */
  webRoot?: string;
  /** Loaded HTTPS material, if the server is serving HTTPS. */
  tls?: LoadedTls | null;
}

export const SESSION_COOKIE = 'clinic_session';

/** Requires a logged-in user. Users who must change their password are blocked from everything else. */
export function requireUser(req: FastifyRequest, opts: { allowMustChange?: boolean; allowLocked?: boolean } = {}): SessionUser {
  if (!req.user) throw unauthorized();
  if (req.user.locked && !opts.allowLocked) throw new HttpError(423, 'screen_locked', 'The screen is locked. Enter your password to continue.');
  if (req.user.mustChangePassword && !opts.allowMustChange) {
    throw new HttpError(403, 'password_change_required', 'You must change your password before continuing');
  }
  return req.user;
}

export function requirePerm(req: FastifyRequest, perm: Permission): SessionUser {
  const user = requireUser(req);
  if (!can(user.role, perm)) throw forbidden();
  return user;
}

export async function buildApp(ctx: Omit<Ctx, 'throttle'> & { throttle?: LoginThrottle }): Promise<FastifyInstance> {
  const full: Ctx = {
    ...ctx,
    throttle: ctx.throttle ?? new LoginThrottle(ctx.cfg.loginMaxFailures, ctx.cfg.loginLockMinutes, ctx.db),
  };
  const app = Fastify({
    logger: false,
    bodyLimit: 1_000_000,
    trustProxy: false,
    ...(ctx.tls ? { https: { key: ctx.tls.key, cert: ctx.tls.cert, minVersion: 'TLSv1.2' as const } } : {}),
  });
  await app.register(cookie);

  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', undefined);

  app.addHook('onRequest', async (req) => {
    req.sessionToken = req.cookies[SESSION_COOKIE];
    req.user = resolveSession(full.db, full.cfg, req.sessionToken);

    // Defence in depth on top of SameSite=Strict: browsers send Origin on cross-site writes.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin) {
        let originHost = '';
        try {
          originHost = new URL(origin).host;
        } catch {
          /* fall through to rejection */
        }
        if (originHost !== req.headers.host) throw forbidden('Cross-site request blocked');
      }
    }
  });

  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    // Tell browsers to keep using HTTPS for this host (one day: short enough to recover from a certificate mistake).
    if (full.tls) reply.header('Strict-Transport-Security', 'max-age=86400');
    return payload;
  });

  app.setErrorHandler((err: unknown, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ error: { code: 'bad_request', message: (err as Error).message } });
    }
    console.error(err);
    return reply.status(500).send({ error: { code: 'server_error', message: 'Something went wrong. Nothing was saved.' } });
  });

  if (ctx.webRoot) {
    await app.register(fastifyStatic, { root: ctx.webRoot });
  }
  app.setNotFoundHandler((req, reply) => {
    // Single-page app: unknown non-API GETs get index.html so client-side routes survive a refresh.
    if (ctx.webRoot && req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    return reply.status(404).send({ error: { code: 'not_found', message: 'Not found' } });
  });

  registerAuthRoutes(app, full);
  registerUserRoutes(app, full);
  registerPatientRoutes(app, full);
  registerAppointmentRoutes(app, full);
  registerVisitRoutes(app, full);
  registerIpdRoutes(app, full);
  registerMedicineRoutes(app, full);
  registerDischargeRoutes(app, full);
  registerBillingRoutes(app, full);
  registerPrintLogRoutes(app, full);
  registerExportRoutes(app, full);
  registerAttachmentRoutes(app, full);
  registerStationRoutes(app, full);
  registerPricingRoutes(app, full);
  registerChecklistRoutes(app, full);
  registerBackupRoutes(app, full);
  registerSecurityRoutes(app, full);
  registerAuditRoutes(app, full);
  registerTemplateRoutes(app, full);
  registerTvRoutes(app, full);
  registerAntenatalChecklistRoutes(app, full);
  registerPediatricRoutes(app, full);
  registerClinicalSummaryRoutes(app, full);
  registerCommunicationRoutes(app, full);
  registerUltrasoundRoutes(app, full);
  registerLabRoutes(app, full);
  registerPartographRoutes(app, full);
  registerOperativeNoteRoutes(app, full);
  registerRiskAssessmentRoutes(app, full);
  registerObstetricDischargeRoutes(app, full);
  registerMaternityAdmissionRoutes(app, full);
  registerAntenatalLabTrendsRoutes(app, full);
  registerMedicationSafetyRoutes(app, full);
  registerPphResuscitationRoutes(app, full);
  registerNeonatalResuscitationRoutes(app, full);
  registerMaternalMeowsRoutes(app, full);
  registerNeonatalJaundiceRoutes(app, full);
  registerInfertilityFolliculometryRoutes(app, full);
  registerErasReedaRoutes(app, full);
  registerGestationalDiabetesRoutes(app, full);
  registerCardiotocographyRoutes(app, full);
  registerPediatricGrowthRoutes(app, full);
  registerCervicalScreeningRoutes(app, full);
  registerContraceptionRoutes(app, full);
  registerPndtRoutes(app, full);
  registerGeneticScreeningRoutes(app, full);
  registerFetalDopplerRoutes(app, full);
  registerPreeclampsiaScreeningRoutes(app, full);
  registerMultipleGestationRoutes(app, full);
  registerInductionRoutes(app, full);
  registerPerinatalLossRoutes(app, full);
  registerArtCycleRoutes(app, full);
  registerEndometriosisRoutes(app, full);
  registerUrogynecologyRoutes(app, full);
  registerGynOncologyRoutes(app, full);
  registerSncuRoutes(app, full);
  registerCommunicationRecallRoutes(app, full);
  registerWardBoardRoutes(app, full);
  registerTeleconsultationRoutes(app, full);
  registerAbdmRoutes(app, full);
  registerOtSchedulerRoutes(app, full);
  registerBloodBankRoutes(app, full);
  registerPediatricRenalRoutes(app, full);
  registerAmsRoutes(app, full);
  registerObstetricHduRoutes(app, full);
  registerPalsPewsRoutes(app, full);
  registerNicuTpnRoutes(app, full);
  registerMaternalComorbiditiesRoutes(app, full);
  registerPediatricAllergyRoutes(app, full);
  registerNeonatalHieRoutes(app, full);
  registerMaternalSepsisRoutes(app, full);
  registerPediatricDkaRoutes(app, full);
  registerNeonatalRdsRoutes(app, full);
  registerMaternalVteRoutes(app, full);
  registerPediatricSeizuresRoutes(app, full);
  registerNeonatalSepsisRoutes(app, full);
  registerObstetricHypertensionRoutes(app, full);
  registerPediatricSepticShockRoutes(app, full);
  registerNeonatalHypoglycemiaRoutes(app, full);
  registerObstetricPphRoutes(app, full);
  registerPediatricPardsRoutes(app, full);
  registerNeonatalBindAabrRoutes(app, full);
  registerObstetricIcpRoutes(app, full);
  registerPediatricStatusEpilepticusRoutes(app, full);
  registerNeonatalNecRoutes(app, full);
  registerObstetricPasRoutes(app, full);
  registerPediatricTbiPecarnRoutes(app, full);
  registerNeonatalPphnRoutes(app, full);
  registerObstetricAfeRoutes(app, full);
  registerPediatricAsthmaStatusRoutes(app, full);
  registerNeonatalBpdRoutes(app, full);
  registerObstetricAflpRoutes(app, full);
  registerPediatricPolytraumaRoutes(app, full);
  registerNeonatalHspdaRoutes(app, full);
  registerObstetricDkaRoutes(app, full);
  registerPediatricAnaphylaxisRoutes(app, full);
  registerNeonatalIvhRoutes(app, full);
  registerObstetricPpromRoutes(app, full);
  registerPediatricSvtRoutes(app, full);
  registerNeonatalHypocalcemiaRoutes(app, full);
  registerObstetricPosttermRoutes(app, full);
  registerPediatricCroupRoutes(app, full);
  registerNeonatalPolycythemiaRoutes(app, full);
  registerObstetricShoulderDystociaRoutes(app, full);
  registerPediatricForeignBodyRoutes(app, full);
  registerNeonatalHypomagnesemiaRoutes(app, full);
  registerObstetricPpcmRoutes(app, full);
  registerPediatricSepticArthritisRoutes(app, full);
  registerNeonatalChylothoraxRoutes(app, full);
  registerObstetricCordProlapseRoutes(app, full);
  registerPediatricIntussusceptionRoutes(app, full);
  registerNeonatalMasRoutes(app, full);
  registerObstetricUterineInversionRoutes(app, full);
  registerPediatricAppendicitisRoutes(app, full);
  registerNeonatalTtnRoutes(app, full);
  registerObstetricPdphRoutes(app, full);
  registerPediatricBacterialMeningitisRoutes(app, full);
  registerNeonatalAopRoutes(app, full);
  registerObstetricRetainedPlacentaRoutes(app, full);
  registerPediatricPyloricStenosisRoutes(app, full);
  registerNeonatalSghRoutes(app, full);
  registerObstetricTolacRoutes(app, full);
  registerPediatricKawasakiRoutes(app, full);
  registerNeonatalVolvulusRoutes(app, full);
  registerObstetricEcvRoutes(app, full);
  registerPediatricDkaCerebralEdemaRoutes(app, full);
  registerNeonatalMeconiumIleusRoutes(app, full);
  registerObstetricPlacentalAbruptionRoutes(app, full);
  registerPediatricHusRoutes(app, full);
  registerNeonatalEaTefRoutes(app, full);
  registerObstetricVasaPreviaRoutes(app, full);
  registerPediatricEmpyemaRoutes(app, full);
  registerNeonatalAbdominalDefectsRoutes(app, full);
  registerObstetricSptRoutes(app, full);
  registerPediatricOsteomyelitisRoutes(app, full);
  registerNeonatalIntestinalAtresiaRoutes(app, full);
  registerObstetricHellpRoutes(app, full);
  registerPediatricScfeRoutes(app, full);
  registerNeonatalCdhRoutes(app, full);
  registerObstetricHyperemesisRoutes(app, full);
  registerPediatricAcuteScrotumRoutes(app, full);
  registerNeonatalSipRoutes(app, full);
  registerObstetricPmcdRoutes(app, full);
  registerPediatricGbsRoutes(app, full);

  app.get('/api/health', async () => ({ ok: true }));
  return app;
}
