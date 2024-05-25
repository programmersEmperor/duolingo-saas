import { NextRequest } from "next/server";
import response from "../response";
import { auth } from "@clerk/nextjs/server";
import db from "@/db/drizzle";
import { challengeProgress, challenges, lessons, units, userProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest){
    const {userId} = await auth();
    if(!userId){
        return response('unauthorized', null);
    }

    const myUserProgress = await db.query.userProgress.findFirst({
        where: eq(userProgress.userId, userId),
        with: {
            activeCourse: true
        }
    });

    if(!myUserProgress?.activeCourseId){
        return response('units fetched' , [])
    }

    const myUnits = await db.query.units.findMany({
        where: eq(units.courseId, myUserProgress.activeCourseId),
        with: {
            lessons: {
                with: {
                    challenges: {
                        with: {
                            challengeProgress: {
                                where: eq(challengeProgress.userId, userId)
                            },
                        }
                    }
                }
            }
        } 
    })

    const normalizedUnits = myUnits.map((unit)=>{
        const lessonWithCompletedStatus = unit.lessons.map((lesson) => {
            if(lesson.challenges.length === 0){
                return {...lesson, completed: false}
            }

            const allCompletedChallenges = lesson.challenges.every((challenge)=>{
                return challenge.challengeProgress && challenge.challengeProgress.length > 0 && challenge.challengeProgress.every(process=> process.completed)
            })

            return {...lesson, completed: allCompletedChallenges}
        })
        return {...unit, completed: lessonWithCompletedStatus}
    })




    return response('successfully', normalizedUnits)
}