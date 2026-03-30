import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import TherapistRepository from '#repositories/therapist_repository'
import AvailabilitySlotRepository from '#repositories/availability_slot_repository'
import { Specialty } from '#enums/specialty'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const therapistRepository = new TherapistRepository()
const availabilitySlotRepository = new AvailabilitySlotRepository()

interface SeedTherapist {
  email: string
  fullName: string
  professionalTitle: string
  specialties: Specialty[]
  about?: string | null
  profilePhotoUrl?: string | null
  rateCents?: number | null
  education?: string | null
  yearsOfExperience?: number | null
}

/** Default recurring slot: Mon–Sat 9:00–17:00 so sessions can be booked (0=Sun, 1=Mon…6=Sat) */
const DEFAULT_SLOTS = [
  {
    type: 'recurring' as const,
    label: 'Weekdays & Saturday',
    days: [1, 2, 3, 4, 5, 6],
    startTime: '09:00',
    endTime: '17:00',
  },
]

const THERAPISTS: SeedTherapist[] = [
  {
    email: 'igwezehycient86+10@gmail.com',
    fullName: 'Igweze Hycient',
    professionalTitle: 'PhD, LMFT',
    specialties: [Specialty.ANXIETY, Specialty.TRAUMA],
    about:
      'Dr. Sarah Johnson is a compassionate therapist dedicated to helping individuals navigate anxiety and trauma. With over a decade of experience, she specializes in evidence-based approaches and creates a safe, non-judgmental space for healing.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
    rateCents: 15000,
    education:
      'PhD in Marriage and Family Therapy, University of Southern California • 2012\nMA in Clinical Psychology, UCLA • 2008',
    yearsOfExperience: 12,
  },
  {
    email: 'igwezehycient86+11@gmail.com',
    fullName: 'Hycient Igweze',
    professionalTitle: 'PsyD',
    specialties: [Specialty.DEPRESSION, Specialty.CBT],
    about:
      'Mark Davis brings a warm, collaborative approach to treating depression and mood disorders. He integrates cognitive behavioral therapy with mindfulness to help clients build lasting change.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    rateCents: 14000,
    education:
      'PsyD in Clinical Psychology, Alliant International University • 2014\nBA in Psychology, UC Berkeley • 2008',
    yearsOfExperience: 10,
  },
  {
    email: 'sarah.johnson@haven-therapy.dev',
    fullName: 'Dr. Sarah Johnson',
    professionalTitle: 'PhD, LMFT',
    specialties: [Specialty.ANXIETY, Specialty.TRAUMA],
    about:
      'Dr. Sarah Johnson is a compassionate therapist dedicated to helping individuals navigate anxiety and trauma. With over a decade of experience, she specializes in evidence-based approaches and creates a safe, non-judgmental space for healing.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
    rateCents: 15000,
    education:
      'PhD in Marriage and Family Therapy, University of Southern California • 2012\nMA in Clinical Psychology, UCLA • 2008',
    yearsOfExperience: 12,
  },
  {
    email: 'mark.davis@haven-therapy.dev',
    fullName: 'Mark Davis',
    professionalTitle: 'PsyD',
    specialties: [Specialty.DEPRESSION, Specialty.CBT],
    about:
      'Mark Davis brings a warm, collaborative approach to treating depression and mood disorders. He integrates cognitive behavioral therapy with mindfulness to help clients build lasting change.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    rateCents: 14000,
    education:
      'PsyD in Clinical Psychology, Alliant International University • 2014\nBA in Psychology, UC Berkeley • 2008',
    yearsOfExperience: 10,
  },
  {
    email: 'elena.rodriguez@haven-therapy.dev',
    fullName: 'Elena Rodriguez',
    professionalTitle: 'LCSW',
    specialties: [Specialty.FAMILY_THERAPY, Specialty.STRESS_MANAGEMENT],
    about:
      'Elena Rodriguez specializes in family systems and stress management. She works with individuals and families to improve communication, resolve conflict, and build resilience.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop',
    rateCents: 13500,
    education: 'MSW, Columbia University • 2011\nBA in Sociology, NYU • 2008',
    yearsOfExperience: 13,
  },
  {
    email: 'james.chen@haven-therapy.dev',
    fullName: 'Dr. James Chen',
    professionalTitle: 'PhD, Clinical Psychologist',
    specialties: [Specialty.PTSD, Specialty.TRAUMA],
    about:
      'Dr. James Chen is a clinical psychologist with expertise in trauma and PTSD. He uses trauma-informed and evidence-based treatments to support recovery and post-traumatic growth.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
    rateCents: 17500,
    education:
      'PhD in Clinical Psychology, Stanford University • 2013\nMA in Counseling Psychology, Boston University • 2009',
    yearsOfExperience: 11,
  },
  {
    email: 'priya.sharma@haven-therapy.dev',
    fullName: 'Priya Sharma',
    professionalTitle: 'LMHC',
    specialties: [Specialty.MINDFULNESS, Specialty.SELF_ESTEEM],
    about:
      'Priya Sharma combines mindfulness and self-compassion approaches to help clients with self-esteem, anxiety, and life transitions. She believes in the power of present-moment awareness for lasting change.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    rateCents: 13000,
    education:
      'MA in Mental Health Counseling, Northwestern University • 2015\nBA in Psychology, University of Michigan • 2012',
    yearsOfExperience: 9,
  },
  {
    email: 'michael.brown@haven-therapy.dev',
    fullName: 'Michael Brown',
    professionalTitle: 'LPC',
    specialties: [Specialty.ADHD, Specialty.CBT],
    about:
      'Michael Brown specializes in ADHD and executive function challenges. He uses CBT and practical strategies to help adults and teens thrive at work, school, and in relationships.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    rateCents: 14500,
    education:
      'MA in Professional Counseling, Texas A&M • 2013\nBS in Psychology, University of Texas • 2010',
    yearsOfExperience: 11,
  },
  {
    email: 'rachel.green@haven-therapy.dev',
    fullName: 'Rachel Green',
    professionalTitle: 'LMFT',
    specialties: [Specialty.RELATIONSHIPS, Specialty.GRIEF],
    about:
      'Rachel Green supports individuals and couples through relationship issues and grief. She draws on attachment theory and narrative approaches to foster connection and meaning-making.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
    rateCents: 15500,
    education:
      'MS in Marriage and Family Therapy, Pepperdine University • 2012\nBA in Human Development, UC Davis • 2009',
    yearsOfExperience: 12,
  },
  {
    email: 'david.kim@haven-therapy.dev',
    fullName: 'Dr. David Kim',
    professionalTitle: 'PsyD, DBT',
    specialties: [Specialty.DBT, Specialty.ANXIETY],
    about:
      'Dr. David Kim is trained in Dialectical Behavior Therapy (DBT) and treats anxiety, emotion regulation, and interpersonal challenges. He is committed to helping clients build a life worth living.',
    profilePhotoUrl:
      'https://images.unsplash.com/photo-1618499892175-6c1c0a0d1b2e?w=400&h=400&fit=crop',
    rateCents: 16500,
    education:
      'PsyD in Clinical Psychology, Loyola University Maryland • 2014\nMA in Psychology, Johns Hopkins • 2010',
    yearsOfExperience: 10,
  },
]

export default class SeedTherapistsCommand extends BaseCommand {
  static commandName = 'seed:therapists'

  static description = 'Create 7+ therapists with availability; write credentials to storage/therapist_credentials.txt. Idempotent (skips existing emails).'

  static options: CommandOptions = {
    startApp: true,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  async run() {
    const created: string[] = []
    const skipped: string[] = []

    for (const t of THERAPISTS) {
      try {
        // const existing = await therapistRepository.findByEmail(t.email)
        // if (existing) {
        //   skipped.push(t.email)
        //   this.logger.info(`Therapist already exists: ${t.email}`)
        //   continue
        // }

        const therapist = await therapistRepository.create({
          email: t.email,
          fullName: t.fullName,
          professionalTitle: t.professionalTitle,
          specialties: t.specialties,
          emailVerified: true,
          acceptingNewClients: true,
          about: t.about ?? null,
          profilePhotoUrl: t.profilePhotoUrl ?? null,
          rateCents: t.rateCents ?? null,
          education: t.education ?? null,
          yearsOfExperience: t.yearsOfExperience ?? null,
        })

        for (let i = 0; i < DEFAULT_SLOTS.length; i++) {
          const s = DEFAULT_SLOTS[i]
          await availabilitySlotRepository.create({
            therapistId: therapist.id,
            type: s.type,
            label: s.label ?? null,
            days: s.days ?? null,
            startTime: s.startTime,
            endTime: s.endTime,
            sortOrder: i,
          })
        }

        created.push(t.email)
        this.logger.info(`Created therapist: ${t.fullName} (${t.email})`)
      } catch (err) {
        this.logger.warning(`Skipped ${t.email}: ${err instanceof Error ? err.message : String(err)}`)
        skipped.push(t.email)
      }
    }

    const lines: string[] = [
      'Haven Therapist Seed – Credentials',
      '================================',
      '',
      'Therapists use OTP login (no password). Use the Haven Therapist app and send OTP to the email below.',
      '',
      'Created in this run:',
      ...created.map((e) => `  - ${e}`),
      '',
      'Skipped (already existed):',
      ...skipped.map((e) => `  - ${e}`),
      '',
      '--- All therapist accounts ---',
      '',
    ]

    for (const t of THERAPISTS) {
      const rate = t.rateCents != null ? `$${t.rateCents / 100}/session` : '—'
      const exp = t.yearsOfExperience != null ? `${t.yearsOfExperience} yrs` : '—'
      lines.push(`${t.fullName}`)
      lines.push(`  Email:        ${t.email}`)
      lines.push(`  Title:        ${t.professionalTitle}`)
      lines.push(`  Specialties:  ${t.specialties.join(', ')}`)
      lines.push(`  Rate:         ${rate}`)
      lines.push(`  Experience:   ${exp}`)
      lines.push(`  Login:        Use Haven Therapist app → Send OTP to this email`)
      lines.push('')
    }

    const outPath = join(process.cwd(), 'storage', 'therapist_credentials.txt')
    mkdirSync(join(process.cwd(), 'storage'), { recursive: true })
    writeFileSync(outPath, lines.join('\n'), 'utf8')
    this.logger.info(`Wrote credentials to ${outPath}`)
  }
}
